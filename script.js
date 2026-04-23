const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const masterSheet = encodeURIComponent("Master Data 2026");
const feesSheet = encodeURIComponent("Fees Collection");
const awSheet = encodeURIComponent("AW");
const dsSheet = encodeURIComponent("DS n Notice");

let originalDiscount = 0;
let globalNotification = "No notification to show";

async function login() {
    const code = document.getElementById("loginCode").value.trim();
    if (!code) { alert("Enter Login Code"); return; }

    document.getElementById("loginBtn").disabled = true;
    document.getElementById("loader").style.display = "block";

    try {
        // 1. Fetch Basic Info
        let awResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${awSheet}?key=${apiKey}`);
        let awRows = (await awResp.json()).values || [];
        let student = findInRows(awRows, 29, code);

        if (!student) { alert("Invalid Login Code"); location.reload(); return; }
        if (student[31]?.toUpperCase() === "TRUE") { alert("Login Blocked."); location.reload(); return; }

        // 2. Fetch Master Data & DS/Notice
        let [masterResp, dsResp] = await Promise.all([
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${masterSheet}?key=${apiKey}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`)
        ]);

        let masterRows = (await masterResp.json()).values || [];
        let dsRows = (await dsResp.json()).values || [];
        let mData = findInRows(masterRows, 1, student[1]);

        // 3. Process Permissions (K14, K16, K20)
        handlePermissions(dsRows);

        // 4. Populate Student Header
        populateStudentProfile(student, mData);

        // 5. Fetch and Populate Fees
        await handleFees(student[1], mData);

        // 6. Setup Date Sheet
        setupDateSheet(dsRows, mData[14]); // mData[14] is Class

        // Final UI Switch
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";

    } catch (e) {
        console.error(e);
        alert("Error loading data.");
        document.getElementById("loader").style.display = "none";
    }
}

function findInRows(rows, colIdx, value) {
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][colIdx] && rows[i][colIdx].trim() == value) return rows[i];
    }
    return null;
}

function handlePermissions(rows) {
    // K is index 10, Row 14 is index 13
    const dsStatus = rows[13] ? rows[13][10] : ""; 
    const resStatus = rows[15] ? rows[15][10] : "";
    const notifStatus = rows[19] ? rows[19][10] : "";
    
    if (dsStatus === "Publish") {
        let b = document.getElementById("btn-datesheet");
        b.classList.remove("frozen");
        b.onclick = () => showView('view-datesheet');
    }
    if (resStatus === "Publish") {
        let b = document.getElementById("btn-result");
        b.classList.remove("frozen");
        b.onclick = () => showView('view-result');
    }
    if (notifStatus === "Publish") {
        globalNotification = rows[20] ? rows[20][9] : "No notification"; // J21
    }
}

function setupDateSheet(rows, studentClass) {
    const examType = rows[0] ? rows[0][1] : ""; // B1
    document.getElementById("ds-title").innerText = "Date Sheet: " + examType;
    
    // Find column for student class (Columns B to P are index 1 to 15)
    let classCol = -1;
    const headerRow = rows[1]; // Row 2
    for(let j=1; j<=15; j++) {
        if(headerRow[j] == studentClass) { classCol = j; break; }
    }

    let html = "";
    if(classCol !== -1) {
        // Handle Minor Exams (Rows 4-5 -> Index 3-4) for Big Exams
        if(examType.includes("Half Yearly") || examType.includes("Annual")) {
            for(let i=3; i<=4; i++) {
                if(rows[i] && rows[i][0]) html += `<tr><td>${rows[i][0]}</td><td>${rows[i][classCol] || '-'}</td></tr>`;
            }
        }
        // Handle Major Exams (Rows 7-12 -> Index 6-11)
        for(let i=6; i<=11; i++) {
            if(rows[i] && rows[i][0]) html += `<tr><td>${rows[i][0]}</td><td>${rows[i][classCol] || '-'}</td></tr>`;
        }
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>No Schedule Found</td></tr>";
}

async function handleFees(adm, mData) {
    let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${feesSheet}?key=${apiKey}`);
    let rows = (await resp.json()).values || [];
    
    let monthlyTuition = parseFloat(mData[4]) || 0;
    let discount = parseFloat(mData[5]) || 0;
    originalDiscount = discount;
    let tuitionMonths = parseFloat(mData[6]) || 0;
    let transportFees = parseFloat(mData[7]) || 0;
    let transportMonths = parseFloat(mData[8]) || 0;
    let examFee = parseFloat(mData[9]) || 1000;
    let prevRemain = parseFloat(mData[3]) || 0;

    let tableHtml = "", totalPaid = 0;
    rows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] == "2026-27" && r[6]?.toLowerCase() == "monthly fees") totalPaid += amt;
            tableHtml += `<tr><td>${r[1]}</td><td>${r[0]}</td><td>₹${amt}</td><td>${r[6]}</td><td>${r[7]}</td><td>${r[8]}</td><td>${r[9]}</td><td>${r[10]}</td><td>${r[11]}</td></tr>`;
        }
    });

    let totalFee = ((monthlyTuition - discount) * tuitionMonths) + (transportFees * transportMonths) + examFee + prevRemain;
    let balance = Math.round(totalFee - totalPaid);

    document.getElementById("feeTable").innerHTML = tableHtml;
    document.getElementById("monthlyTuition").innerText = "₹" + monthlyTuition;
    document.getElementById("examFee").innerText = "₹" + examFee;
    document.getElementById("feeBalance").innerText = "₹" + balance;
    document.getElementById("feeBalance").style.color = balance > 0 ? "red" : "green";

    populateFeeSelectors(examFee, monthlyTuition, transportFees);
}

function showView(viewId) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    views.forEach(v => document.getElementById(v).style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    window.scrollTo(0,0);
}

function showNotification() {
    alert("📢 School Notice:\n\n" + globalNotification);
}

function populateStudentProfile(aw, master) {
    document.getElementById("welcomeName").innerText = "Welcome, " + aw[3];
    document.getElementById("studentName").innerText = aw[3];
    document.getElementById("adm").innerText = aw[1];
    document.getElementById("class").innerText = master[14];
    document.getElementById("father").innerText = aw[6];
    
    // Photo Logic
    if (aw[28]) {
        const fileId = aw[28].includes("id=") ? aw[28].split("id=")[1].split("&")[0] : aw[28].split("/d/")[1]?.split("/")[0];
        if (fileId) {
            const img = document.getElementById("studentPhoto");
            img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
            img.style.display = "inline-block";
        }
    }
}

// Logic for Fee Selectors (Similar to your original)
function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths");
    const tr = document.getElementById("calcTransportMonths");
    const ex = document.getElementById("calcExamMonths");
    t.innerHTML = tr.innerHTML = ex.innerHTML = "";
    for(let i=0; i<=12; i++) t.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=11; i++) tr.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=2; i++) ex.innerHTML += `<option value="${i}">${i}</option>`;

    const calc = () => {
        let total = (t.value * (monthly - originalDiscount)) + (tr.value * transport) + (ex.value * (exFee/2));
        document.getElementById("calcTotal").innerText = "₹" + Math.round(total);
    };
    t.onchange = tr.onchange = ex.onchange = calc;
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn").addEventListener("click", login);
});
