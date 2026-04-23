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
        let awResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${awSheet}?key=${apiKey}`);
        let awRows = (await awResp.json()).values || [];
        let student = findInRows(awRows, 29, code);

        if (!student) { alert("Invalid Login Code"); location.reload(); return; }
        if (student[31]?.toUpperCase() === "TRUE") { alert("Login Blocked."); location.reload(); return; }

        let [masterResp, dsResp] = await Promise.all([
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${masterSheet}?key=${apiKey}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`)
        ]);

        let masterRows = (await masterResp.json()).values || [];
        let dsRows = (await dsResp.json()).values || [];
        let mData = findInRows(masterRows, 1, student[1]);

        handlePermissions(dsRows);
        populateStudentProfile(student, mData);
        await handleFees(student[1], mData);
        setupDateSheet(dsRows, mData[14]);

        document.getElementById("loginBox").style.display = "none";
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        setupSendScreenshotButtons();

    } catch (e) {
        console.error(e);
        alert("Error loading data.");
        document.getElementById("loader").style.display = "none";
        document.getElementById("loginBtn").disabled = false;
    }
}

function findInRows(rows, colIdx, value) {
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][colIdx] && rows[i][colIdx].trim() == value) return rows[i];
    }
    return null;
}

function handlePermissions(rows) {
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
        globalNotification = rows[20] ? rows[20][9] : "No notification to show"; 
    }
}

function setupDateSheet(rows, studentClass) {
    const examType = rows[0] ? rows[0][1] : ""; 
    document.getElementById("ds-title").innerText = "Date Sheet: " + examType;
    
    let classCol = -1;
    const headerRow = rows[1]; 
    for(let j=1; j<=15; j++) { if(headerRow[j] == studentClass) { classCol = j; break; } }

    let html = "";
    const isMajorExam = examType.includes("Half Yearly") || examType.includes("Annual");

    if(classCol !== -1) {
        if(isMajorExam) {
            html += `<tr class="ds-type-header"><td colspan="2">Minor Exams</td></tr>`;
            [3, 4].forEach(idx => {
                if(rows[idx] && rows[idx][0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`;
            });
            html += `<tr class="ds-type-header"><td colspan="2">Major Exams</td></tr>`;
        }
        [6, 7, 8, 9, 10, 11].forEach(idx => {
            if(rows[idx] && rows[idx][0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`;
        });
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>Nothing to show</td></tr>";
}

function populateStudentProfile(aw, master) {
    document.getElementById("welcomeName").innerText = "Welcome, " + aw[3];
    document.getElementById("studentName").innerText = aw[3];
    document.getElementById("adm").innerText = aw[1];
    document.getElementById("class").innerText = master[14];
    document.getElementById("father").innerText = aw[6];
    document.getElementById("mother").innerText = aw[5];
    document.getElementById("phone").innerText = aw[22];
    document.getElementById("address").innerText = aw[7];
    
    if (aw[28]) {
        let fileId = "";
        if (aw[28].includes("id=")) fileId = aw[28].split("id=")[1].split("&")[0];
        else if (aw[28].includes("/d/")) fileId = aw[28].split("/d/")[1].split("/")[0];
        if (fileId) {
            const img = document.getElementById("studentPhoto");
            img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
            img.style.display = "inline-block";
        }
    }
}

async function handleFees(adm, mData) {
    let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${feesSheet}?key=${apiKey}`);
    let rows = (await resp.json()).values || [];
    
    let monthlyTuition = parseFloat(mData[4]) || 0;
    let prevRemain = parseFloat(mData[3]) || 0;
    let discount = parseFloat(mData[5]) || 0;
    originalDiscount = discount;
    let tuitionMonths = parseFloat(mData[6]) || 0;
    let transportFees = parseFloat(mData[7]) || 0;
    let transportMonths = parseFloat(mData[8]) || 0;
    let examFee = parseFloat(mData[9]) || 1000;

    let tableHtml = "";
    let cardsHtml = "";
    let totalPaid = 0;

    // Loop through all fee records
    for (let i = 1; i < rows.length; i++) {
        let r = rows[i];
        if (r[2] == adm) {
            let date = r[1] || "";
            let slip = r[0] || "";
            let amount = parseFloat(r[5]) || 0;
            let feeType = r[6] || "";
            let session = r[7] || "";
            let tMonths = r[8] || "";
            let trMonths = r[9] || "";
            let exMonths = r[10] || "";
            let mode = r[11] || "";

            if (session == "2026-27" && feeType.toLowerCase() == "monthly fees") {
                totalPaid += amount;
            }

            // Desktop Table Rows
            tableHtml += `<tr>
                <td>${date}</td><td>${slip}</td><td>₹${amount}</td>
                <td>${feeType}</td><td>${session}</td><td>${tMonths}</td>
                <td>${trMonths}</td><td>${exMonths}</td><td>${mode}</td>
            </tr>`;

            // Mobile Cards (This sequence allows nth-child(even) to work)
            cardsHtml += `
            <div class="fee-card">
                <div><b>Date:</b> ${date}</div>
                <div><b>Slip Number:</b> ${slip}</div>
                <div><b>Amount Paid:</b> ₹${amount}</div>
                <div><b>Fee Type:</b> ${feeType}</div>
                <div><b>Session:</b> ${session}</div>
                <div><b>Tuition Fee Months:</b> ${tMonths}</div>
                <div><b>Transport Fee Months:</b> ${trMonths}</div>
                <div><b>Exam Fee Months:</b> ${exMonths}</div>
                <div><b>Payment Mode:</b> ${mode}</div>
            </div>`;
        }
    }

    // Final Calculation
    let totalFee = ((monthlyTuition - discount) * tuitionMonths) + (transportFees * transportMonths) + examFee + prevRemain;
    let balance = Math.round(totalFee - totalPaid);

    // Populate the UI
    document.getElementById("feeTable").innerHTML = tableHtml;
    document.getElementById("feeCards").innerHTML = cardsHtml;
    
    document.getElementById("monthlyTuition").innerText = "₹" + monthlyTuition;
    document.getElementById("tuitionMonths").innerText = tuitionMonths;
    document.getElementById("transportFees").innerText = "₹" + transportFees;
    document.getElementById("transportMonths").innerText = transportMonths;
    document.getElementById("examFee").innerText = "₹" + examFee;
    document.getElementById("prevRemain").innerText = "₹" + prevRemain;
    document.getElementById("discount").innerText = "₹" + Math.round(discount);
    document.getElementById("totalPaid").innerText = "₹" + totalPaid;
    
    let balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance;
    balEl.style.color = balance > 0 ? "red" : "green";

    populateFeeSelectors(examFee, monthlyTuition, transportFees);
    setupPaymentLink(balance, "payBalanceBtn");
}
function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths");
    const tr = document.getElementById("calcTransportMonths");
    const ex = document.getElementById("calcExamMonths");
    t.innerHTML = tr.innerHTML = ex.innerHTML = "";
    for(let i=0; i<=12; i++) t.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=11; i++) tr.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=2; i++) ex.innerHTML += `<option value="${i}">${i}</option>`;
    const updateCalc = () => {
        let total = (t.value * (monthly - originalDiscount)) + (tr.value * transport) + (ex.value * (exFee/2));
        document.getElementById("calcTotal").innerText = "₹" + Math.round(total);
        setupPaymentLink(total, "payNowBtn");
    };
    t.onchange = tr.onchange = ex.onchange = updateCalc;
}

function setupPaymentLink(amount, btnId) {
    document.getElementById(btnId).onclick = () => {
        if (amount <= 0) { alert("Amount must be greater than 0"); return; }
        const note = encodeURIComponent(`${document.getElementById("adm").innerText} ${document.getElementById("studentName").innerText} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amount}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const msg = encodeURIComponent(`Hello, I have completed the payment.\nAdmission No: ${document.getElementById("adm").innerText}\nName: ${document.getElementById("studentName").innerText}\nClass: ${document.getElementById("class").innerText}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    document.getElementById("sendScreenshotBalanceBtn").onclick = handler;
    document.getElementById("sendScreenshotCalcBtn").onclick = handler;
}

function showView(viewId) {
    ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'].forEach(v => {
        document.getElementById(v).style.display = (v === viewId) ? 'block' : 'none';
    });
    window.scrollTo(0,0);
}

function showNotification() { alert("📢 School Notice:\n\n" + globalNotification); }

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn").onclick = login;
});
