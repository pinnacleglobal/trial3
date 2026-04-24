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

        const student = awRows.find(r => r[29] && r[29].trim() === code);
        
        if (!student) { 
            alert("Invalid Login Code.");
            resetLoader();
            return; 
        }

        const mRow = masterRows.find(r => r[1] == student[1]);
        if (!mRow) {
            alert("Master Data missing. Contact Admin.");
            resetLoader();
            return;
        }

        handlePermissions(dsRows);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, feesRows);
        setupDateSheet(dsRows, mRow[14]);

        document.getElementById("loginBox").style.display = "none";
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        setupSendScreenshotButtons();

    } catch (e) {
        console.error("Login Error:", e);
        alert("Connection Error. Try again.");
        resetLoader();
    }
}

function resetLoader() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("loginBtn").disabled = false;
}

function handlePermissions(rows) {
    if (!rows || rows.length < 20) return;
    if (rows[13]?.[10] === "Publish") {
        const b = document.getElementById("btn-datesheet");
        if(b) {
            b.classList.remove("frozen");
            b.onclick = () => showView('view-datesheet');
        }
    }
    if (rows[15]?.[10] === "Publish") {
        const b = document.getElementById("btn-result");
        if(b) {
            b.classList.remove("frozen");
            b.onclick = () => showView('view-result');
        }
    }
    if (rows[19]?.[10] === "Publish") {
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

    // Updated Table Header mapping
    const tableHeader = `<tr><th>Date</th><th>Slip Number</th><th>Amount Paid</th><th>Fee Type</th><th>Session</th><th>Tuition Fee Months</th><th>Transport Fee Months</th><th>Exam Fee Months</th><th>Payment Mode</th></tr>`;
    document.querySelector("#view-fees thead").innerHTML = tableHeader;
    
    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") totalPaid += amt;
            
            // Table Rows
            tableHtml += `<tr><td>${r[1]||''}</td><td>${r[0]||''}</td><td>₹${amt}</td><td>${r[6]||''}</td><td>${r[7]||''}</td><td>${r[8]||''}</td><td>${r[9]||''}</td><td>${r[10]||''}</td><td>${r[11]||''}</td></tr>`;
            
            // Fee Cards with Blue Bold Labels
            cardsHtml += `<div class="fee-card">
                <div><span class="label">Date:</span> ${r[1]||''}</div>
                <div><span class="label">Slip Number:</span> ${r[0]||''}</div>
                <div><span class="label">Amount Paid:</span> ₹${amt}</div>
                <div><span class="label">Fee Type:</span> ${r[6]||''}</div>
                <div><span class="label">Session:</span> ${r[7]||''}</div>
                <div><span class="label">Tuition Fee Months:</span> ${r[8]||''}</div>
                <div><span class="label">Transport Fee Months:</span> ${r[9]||''}</div>
                <div><span class="label">Exam Fee Months:</span> ${r[10]||''}</div>
                <div><span class="label">Payment Mode:</span> ${r[11]||''}</div>
            </div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records found</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "No records found";
    
    // ... remaining logic for calculations and balance remains the same ...
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    document.getElementById("tuitionMonths").innerText = mData[6] || 0;
    document.getElementById("transportFees").innerText = "₹" + (mData[7] || 0);
    document.getElementById("transportMonths").innerText = mData[8] || 0;
    document.getElementById("examFee").innerText = "₹" + (mData[9] || 1000);
    document.getElementById("prevRemain").innerText = "₹" + remain;
    document.getElementById("discount").innerText = "₹" + Math.round(disc);

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
            [3, 4].forEach(idx => { if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`; });
            html += `<tr class="ds-type-header" style="background-color: darkblue; color: white;"><td colspan="2">Major Exams</td></tr>`;
        }
        [6, 7, 8, 9, 10, 11].forEach(idx => { if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`; });
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>Nothing to show</td></tr>";
}

function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths");
    const tr = document.getElementById("calcTransportMonths");
    const ex = document.getElementById("calcExamMonths");
    const res = document.getElementById("calcTotal");
    if(!t || !tr || !ex || !res) return;
    t.innerHTML = tr.innerHTML = ex.innerHTML = "";
    for(let i=0; i<=12; i++) t.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=11; i++) tr.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=2; i++) ex.innerHTML += `<option value="${i}">${i}</option>`;
    const updateCalc = () => {
        let total = (t.value * (monthly - originalDiscount)) + (tr.value * transport) + (ex.value * (exFee/2));
        res.innerText = "₹" + Math.round(total);
        setupPaymentLink(total, "payNowBtn");
    };
    t.onchange = tr.onchange = ex.onchange = updateCalc;
}

function setupPaymentLink(amount, btnId) {
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.onclick = () => {
        if (amount <= 0) { alert("Enter an amount greater than 0"); return; }
        const adm = document.getElementById("adm").innerText;
        const name = document.getElementById("studentName").innerText;
        const note = encodeURIComponent(`${adm} ${name} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amount}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const msg = encodeURIComponent(`Hello, I have completed the payment.\nAdmission No: ${document.getElementById("adm").innerText}\nName: ${document.getElementById("studentName").innerText}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    const b1 = document.getElementById("sendScreenshotBalanceBtn");
    const b2 = document.getElementById("sendScreenshotCalcBtn");
    if(b1) b1.onclick = handler;
    if(b2) b2.onclick = handler;
}

function showView(viewId) {
    ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'].forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = (v === viewId) ? 'block' : 'none';
    });
    window.scrollTo(0,0);
}

function showNotification() { alert("📢 School Notice:\n\n" + globalNotification); }

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("loginBtn");
    if(btn) btn.onclick = login;
});
