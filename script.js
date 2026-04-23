const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice")
};

let originalDiscount = 0;
let globalNotification = "No notification to show";

async function login() {
    const codeInput = document.getElementById("loginCode");
    const code = codeInput.value.trim();
    if (!code) { alert("Enter Login Code"); return; }
    
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("loader").style.display = "block";

    try {
        const urls = [
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.aw}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.master}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.fees}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`
        ];

        const responses = await Promise.all(urls.map(url => fetch(url)));
        const data = await Promise.all(responses.map(res => res.json()));

        const awRows = data[0].values || [];
        const masterRows = data[1].values || [];
        const feesRows = data[2].values || [];
        const dsRows = data[3].values || [];

        // 1. Find Student in AW Sheet
        const student = awRows.find(r => r[29] && r[29].trim() === code);
        
        if (!student) { 
            alert("Invalid Login Code. Please check and try again.");
            resetLoader();
            return; 
        }

        if (student[31]?.toUpperCase() === "TRUE") { 
            alert("Login Blocked. Please contact the administrator.");
            resetLoader();
            return; 
        }

        // 2. Find matching Master Data
        const mRow = masterRows.find(r => r[1] == student[1]);
        if (!mRow) {
            alert("Student found, but Master Data is missing. Contact Admin.");
            resetLoader();
            return;
        }

        // 3. Populate everything safely
        handlePermissions(dsRows);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, feesRows);
        setupDateSheet(dsRows, mRow[14]);

        // 4. Show Portal
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        setupSendScreenshotButtons();

    } catch (e) {
        console.error("Login Error:", e);
        alert("Server error or connection timeout. Please try again.");
        resetLoader();
    }
}

function resetLoader() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("loginBtn").disabled = false;
}

function handlePermissions(rows) {
    if (!rows || rows.length < 20) return;
    const dsStatus = rows[13]?.[10]; 
    const resStatus = rows[15]?.[10]; 
    const notifStatus = rows[19]?.[10]; 
    
    if (dsStatus === "Publish") {
        const b = document.getElementById("btn-datesheet");
        b.classList.remove("frozen");
        b.onclick = () => showView('view-datesheet');
    }
    if (resStatus === "Publish") {
        const b = document.getElementById("btn-result");
        b.classList.remove("frozen");
        b.onclick = () => showView('view-result');
    }
    if (notifStatus === "Publish") {
        globalNotification = rows[20]?.[9] || "No notification to show"; 
    }
}

function populateStudentProfile(aw, master) {
    document.getElementById("welcomeName").innerText = "Welcome, " + (aw[3] || "Student");
    document.getElementById("studentName").innerText = aw[3] || "N/A";
    document.getElementById("adm").innerText = aw[1] || "N/A";
    document.getElementById("class").innerText = master[14] || "N/A";
    document.getElementById("father").innerText = aw[6] || "N/A";
    document.getElementById("mother").innerText = aw[5] || "N/A";
    document.getElementById("phone").innerText = aw[22] || "N/A";
    document.getElementById("address").innerText = aw[7] || "N/A";
    
    const photoImg = document.getElementById("studentPhoto");
    photoImg.style.display = "none"; // Hide initially

    if (aw[28]) {
        const fileIdMatch = aw[28].match(/[-\w]{25,}/);
        if (fileIdMatch) {
            photoImg.src = `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w500`;
            photoImg.onload = () => photoImg.style.display = "inline-block";
        }
    }
}

function renderFees(adm, mData, fRows) {
    let monthly = parseFloat(mData[4]) || 0;
    let remain = parseFloat(mData[3]) || 0;
    let disc = parseFloat(mData[5]) || 0;
    originalDiscount = disc;
    
    let tableHtml = "", cardsHtml = "", totalPaid = 0;
    
    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") totalPaid += amt;
            
            tableHtml += `<tr><td>${r[1]||''}</td><td>${r[0]||''}</td><td>₹${amt}</td><td>${r[6]||''}</td><td>${r[7]||''}</td><td>${r[8]||''}</td><td>${r[9]||''}</td><td>${r[10]||''}</td><td>${r[11]||''}</td></tr>`;
            
            cardsHtml += `<div class="fee-card">
                <div><b>Date:</b> ${r[1]||''}</div><div><b>Slip:</b> ${r[0]||''}</div><div><b>Amount:</b> ₹${amt}</div>
                <div><b>Type:</b> ${r[6]||''}</div><div><b>Session:</b> ${r[7]||''}</div>
                <div><b>Tuition Months:</b> ${r[8]||''}</div><div><b>Transport Months:</b> ${r[9]||''}</div>
                <div><b>Exam Months:</b> ${r[10]||''}</div><div><b>Mode:</b> ${r[11]||''}</div>
            </div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records found</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "<div class='profile'>No records found</div>";
    
    // Fee Structure
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    document.getElementById("tuitionMonths").innerText = mData[6] || 0;
    document.getElementById("transportFees").innerText = "₹" + (mData[7] || 0);
    document.getElementById("transportMonths").innerText = mData[8] || 0;
    document.getElementById("examFee").innerText = "₹" + (mData[9] || 1000);
    document.getElementById("prevRemain").innerText = "₹" + remain;
    document.getElementById("discount").innerText = "₹" + Math.round(disc);

    // Summary Math
    let totalFee = ((monthly - disc) * (parseFloat(mData[6]) || 0)) + 
                   ((parseFloat(mData[7]) || 0) * (parseFloat(mData[8]) || 0)) + 
                   (parseFloat(mData[9]) || 1000) + remain;
    let balance = Math.round(totalFee - totalPaid);

    document.getElementById("totalPaid").innerText = "₹" + totalPaid;
    const balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance;
    balEl.style.color = balance > 0 ? "red" : "green";

    populateFeeSelectors(parseFloat(mData[9]) || 1000, monthly, parseFloat(mData[7]) || 0);
    setupPaymentLink(balance, "payBalanceBtn");
}

function setupDateSheet(rows, studentClass) {
    if (!rows || rows.length < 2) return;
    const examType = rows[0]?.[1] || ""; 
    document.getElementById("ds-title").innerText = "Date Sheet: " + examType;
    
    let classCol = -1;
    const headerRow = rows[1]; 
    for(let j=1; j<=15; j++) { if(headerRow[j] == studentClass) { classCol = j; break; } }

    let html = "";
    const isMajor = examType.includes("Half Yearly") || examType.includes("Annual");

    if(classCol !== -1) {
        if(isMajor) {
            html += `<tr class="ds-type-header"><td colspan="2">Minor Exams</td></tr>`;
            [3, 4].forEach(idx => {
                if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`;
            });
            html += `<tr class="ds-type-header"><td colspan="2">Major Exams</td></tr>`;
        }
        [6, 7, 8, 9, 10, 11].forEach(idx => {
            if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`;
        });
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>Nothing to show</td></tr>";
}

function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths");
    const tr = document.getElementById("calcTransportMonths");
    const ex = document.getElementById("calcExamMonths");
    if(!t || !tr || !ex) return;

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
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.onclick = () => {
        if (amount <= 0) { alert("Amount must be greater than 0"); return; }
        const adm = document.getElementById("adm").innerText;
        const name = document.getElementById("studentName").innerText;
        const cls = document.getElementById("class").innerText;
        const note = encodeURIComponent(`${adm} ${name} ${cls} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amount}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const msg = encodeURIComponent(`Hello, I have completed the payment.\nAdmission No: ${document.getElementById("adm").innerText}\nName: ${document.getElementById("studentName").innerText}\nClass: ${document.getElementById("class").innerText}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    if(document.getElementById("sendScreenshotBalanceBtn")) document.getElementById("sendScreenshotBalanceBtn").onclick = handler;
    if(document.getElementById("sendScreenshotCalcBtn")) document.getElementById("sendScreenshotCalcBtn").onclick = handler;
}

function showView(viewId) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = (v === viewId) ? 'block' : 'none';
    });
    window.scrollTo(0,0);
}

function showNotification() { alert("📢 School Notice:\n\n" + globalNotification); }

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn").onclick = login;
});
