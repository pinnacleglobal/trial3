const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice"),
    att: encodeURIComponent("Attendance"),
    res: encodeURIComponent("Res")
};

let originalDiscount = 0;
let globalNotification = "No notification to show";
let currentUserData = {}; 

document.addEventListener("DOMContentLoaded", () => {
    const savedCode = localStorage.getItem("portalLoginCode");
    const savedView = localStorage.getItem("currentView") || "view-dashboard";
    if (savedCode) {
        login(true, savedView);
    } else {
        document.getElementById("loader").style.display = "none";
        document.getElementById("loginBox").style.display = "block";
    }
});

async function login(isAuto = false, targetView = 'view-dashboard') {
    const loginBox = document.getElementById("loginBox");
    const loader = document.getElementById("loader");
    const portal = document.getElementById("portal");
    const code = isAuto ? localStorage.getItem("portalLoginCode") : document.getElementById("loginCode").value.trim();

    if (!code) {
        loader.style.display = "none";
        loginBox.style.display = "block";
        return;
    }

    loginBox.style.display = "none";
    loader.style.display = "block";

    try {
        const priorityUrls = [
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.aw}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.master}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.res}?key=${apiKey}`
        ];

        const pResponses = await Promise.all(priorityUrls.map(url => fetch(url)));
        const pData = await Promise.all(pResponses.map(res => res.json()));

        const student = pData[0].values.find(r => r[29] && r[29].trim() === code);
        if (!student) {
            if (!isAuto) alert("Invalid Login Code");
            logout(); return;
        }

        const mRow = pData[1].values.find(r => r[1] == student[1]);
        
        // Store student info for result processing
        currentUserData = {
            adm: student[1],
            name: student[3],
            class: mRow[14]
        };

        localStorage.setItem("portalLoginCode", code);
        
        // Setup UI
        handlePermissions(pData[2].values);
        populateStudentProfile(student, mRow);
        setupDateSheet(pData[2].values, mRow[14]);
        renderResult(pData[2].values, pData[3].values); // Process Result page

        loader.style.display = "none";
        portal.style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        showView(targetView);

        fetchBackgroundData(student[1], mRow);

    } catch (e) {
        console.error(e);
        loader.style.display = "none";
        loginBox.style.display = "block";
    }
}

function renderResult(dsRows, resRows) {
    const resultView = document.getElementById("view-result");
    
    // Check K16 for Publish status (Row index 15, Column index 10)
    const isPublished = dsRows[15]?.[10] === "Publish";
    // Check K17 for Heading (Row index 16, Column index 10)
    const examHeading = dsRows[16]?.[10] || "Examination Result";

    // IF UN-PUBLISHED
    if (!isPublished) {
        resultView.innerHTML = `
            <div class="section-title">Result</div>
            <div class="profile" style="text-align:center; padding: 50px 20px;">
                <h3 style="color: #666;">No result to show</h3>
            </div>
            <button class="back-btn" onclick="showView('view-dashboard')">← Back to Dashboard</button>`;
        return;
    }

    // IF PUBLISHED - Logic to fetch data
    let marksCol = 5; // Col F
    let gradeCol = 6; // Col G
    if (examHeading === "Annual Exam") {
        marksCol = 11; // Col L
        gradeCol = 12; // Col M
    }

    // Find student in Res sheet (Column B)
    const studentIdx = resRows.findIndex(r => r[1] == currentUserData.adm);
    if (studentIdx === -1) {
        resultView.innerHTML = `<div class="profile"><h3>Data not found.</h3></div><button class="back-btn" onclick="showView('view-dashboard')">← Back to Dashboard</button>`;
        return;
    }

    // Determine subject count
    let subCount = 6;
    const cls = currentUserData.class;
    if (["Nursery", "LKG", "UKG"].includes(cls)) subCount = 3;
    else if (["1st", "2nd", "3rd", "4th", "5th"].includes(cls)) subCount = 5;

    let tableRows = "";
    let totalMarks = 0;
    const startRow = studentIdx + 5; // 5 cells below admission number cell

    for (let i = 0; i < subCount; i++) {
        const row = resRows[startRow + i];
        if (row) {
            const subject = row[0] || "-";
            const marks = parseFloat(row[marksCol]) || 0;
            const grade = row[gradeCol] || "-";
            totalMarks += marks;
            tableRows += `<tr><td>${subject}</td><td>${marks}</td><td>${grade}</td></tr>`;
        }
    }

    const percentage = (totalMarks / subCount).toFixed(2);

    resultView.innerHTML = `
        <div class="section-title">${examHeading}</div>
        <div class="profile">
            <h3 style="text-align:center; color:#0b3d91; margin-top:0;">Result</h3>
            <div class="info"><span class="label">Student Name :</span> ${currentUserData.name}</div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Subject</th><th>Marks (out of 100)</th><th>Grade</th></tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div style="margin-top:15px; border-top:1px solid #ddd; padding-top:10px;">
                <div class="info"><span class="label">Total Marks :</span> ${totalMarks}</div>
                <div class="info"><span class="label">Percentage :</span> ${percentage}%</div>
            </div>
        </div>
        <button class="back-btn" onclick="showView('view-dashboard')">← Back to Dashboard</button>`;
}
// Ensure the existing functions like showView, logout, populateStudentProfile, etc., are present below

// ... rest of your functions (fetchBackgroundData, renderAttendance, etc.) stay the same ...

async function fetchBackgroundData(adm, mRow) {
    const urls = [
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.fees}?key=${apiKey}`,
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.att}?key=${apiKey}`
    ];
    const responses = await Promise.all(urls.map(url => fetch(url)));
    const data = await Promise.all(responses.map(res => res.json()));

    renderFees(adm, mRow, data[0].values);
    renderAttendance(adm, data[1].values);
    setupSendScreenshotButtons();
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (document.getElementById("portal").style.display === "none") {
        document.getElementById("installBtn").style.display = "block";
    }
});

document.getElementById("installBtn").onclick = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
     
        if (typeof gtag === 'function') {
            gtag('event', 'pwa_install_click', { 'outcome': outcome });
        }
   
        if (outcome === 'accepted') document.getElementById("installBtn").style.display = "none";
        deferredPrompt = null;
    }
};

function renderAttendance(adm, rows) {
    if (!rows || rows.length < 4) return;
    const studentRow = rows.slice(3).find(r => r[2] == adm);
    const months = [
        { name: "April", col: 33 }, { name: "May", col: 65 }, { name: "June", col: 96 },
        { name: "July", col: 128 }, { name: "August", col: 160 }, { name: "September", col: 191 },
        { name: "October", col: 223 }, { name: "November", col: 254 }, { name: "December", col: 286 },
        { name: "January", col: 318 }, { name: "February", col: 348 }, { name: "March", col: 380 }
    ];
    let html = studentRow ? months.map(m => `<tr><td>${m.name}</td><td>${studentRow[m.col] || "0"}</td></tr>`).join('') : "<tr><td>No attendance records found</td></tr>";
    document.getElementById("attBody").innerHTML = html;
}

function showView(viewId, isHardwareBack = false) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = (v === viewId) ? 'block' : 'none';
    });

    localStorage.setItem("currentView", viewId);

    // If we are NOT pressing the back button, tell the browser to remember this page
    if (!isHardwareBack && viewId !== 'view-dashboard') {
        history.pushState({view: viewId}, "");
    }
    
    window.scrollTo(0,0);
}

function getCurrentVisibleView() {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    return views.find(id => document.getElementById(id).style.display === 'block');
}

function logout() { localStorage.clear(); location.reload(); }

function renderFees(adm, mData, fRows) {
    let monthly = parseFloat(mData[4]) || 0, remain = parseFloat(mData[3]) || 0, disc = parseFloat(mData[5]) || 0;
    originalDiscount = disc;
    let tableHtml = "", cardsHtml = "", totalPaid = 0;

    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") totalPaid += amt;
            tableHtml += `<tr><td>${r[1]||''}</td><td>${r[0]||''}</td><td>₹${amt}</td><td>${r[6]||''}</td><td>${r[7]||''}</td><td>${r[8]||''}</td><td>${r[9]||''}</td><td>${r[10]||''}</td><td>${r[11]||''}</td></tr>`;
            cardsHtml += `<div class="fee-card"><div><span class="label">Date:</span> ${r[1]||''}</div><div><span class="label">Slip Number:</span> ${r[0]||''}</div><div><span class="label">Amount Paid:</span> ₹${amt}</div><div><span class="label">Fee Type:</span> ${r[6]||''}</div><div><span class="label">Session:</span> ${r[7]||''}</div><div><span class="label">Tuition Fee Months:</span> ${r[8]||''}</div><div><span class="label">Transport Fee Months:</span> ${r[9]||''}</div><div><span class="label">Exam Fee Months:</span> ${r[10]||''}</div><div><span class="label">Payment Mode:</span> ${r[11]||''}</div></div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records found</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "No records found";
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    document.getElementById("tuitionMonths").innerText = mData[6] || 0;
    document.getElementById("transportFees").innerText = "₹" + (mData[7] || 0);
    document.getElementById("transportMonths").innerText = mData[8] || 0;
    document.getElementById("examFee").innerText = "₹" + (mData[9] || 1000);
    document.getElementById("prevRemain").innerText = "₹" + remain;
    document.getElementById("discount").innerText = "₹" + Math.round(disc);

    let totalFee = ((monthly - disc) * (parseFloat(mData[6]) || 0)) + ((parseFloat(mData[7]) || 0) * (parseFloat(mData[8]) || 0)) + (parseFloat(mData[9]) || 1000) + remain;
    let balance = Math.round(totalFee - totalPaid);
    document.getElementById("totalPaid").innerText = "₹" + totalPaid;
    const balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance;
    balEl.style.color = balance > 0 ? "red" : "green";

    populateFeeSelectors(parseFloat(mData[9]) || 1000, monthly, parseFloat(mData[7]) || 0);
    setupPaymentLink(balance, "payBalanceBtn");
}

function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths"), tr = document.getElementById("calcTransportMonths"), ex = document.getElementById("calcExamMonths"), res = document.getElementById("calcTotal");
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

function handlePermissions(dsRows) {
    if (!dsRows) return;
    
    // 1. Unfreeze Date-Sheet button EVERY TIME
    const bDateSheet = document.getElementById("btn-datesheet"); 
    if(bDateSheet) { 
        bDateSheet.classList.remove("frozen"); 
        bDateSheet.style.opacity = "1";
        bDateSheet.style.cursor = "pointer";
        // Force the click action to work
        bDateSheet.onclick = () => showView('view-datesheet'); 
    }

    // 2. Result button logic (K16 - index 15)
    const bResult = document.getElementById("btn-result");
    if(bResult && dsRows[15]?.[10] === "Publish") {
        bResult.classList.remove("frozen");
        bResult.onclick = () => showView('view-result');
    }
    
    // 3. Notification logic (K20 - index 19)
    if (dsRows[19]?.[10] === "Publish") {
        globalNotification = dsRows[20]?.[9] || "No notification";
    }
}
function populateStudentProfile(aw, master) {
    document.getElementById("welcomeName").innerText = "Welcome, " + (aw[3] || "Student");
    document.getElementById("studentName").innerText = aw[3];
    document.getElementById("adm").innerText = aw[1];
    document.getElementById("class").innerText = master[14];
    document.getElementById("father").innerText = aw[6];
    document.getElementById("mother").innerText = aw[5];
    document.getElementById("phone").innerText = aw[22];
    document.getElementById("address").innerText = aw[7];
    const photoImg = document.getElementById("studentPhoto");
    if (aw[28]) {
        const fileIdMatch = aw[28].match(/[-\w]{25,}/);
        if (fileIdMatch) { 
            photoImg.src = `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w500`; 
            photoImg.onload = () => photoImg.style.display = "inline-block"; 
        }
    }
}
function setupDateSheet(rows, studentClass) {
    const datesheetView = document.getElementById("view-datesheet");
    
    // Check K14 status (Row index 13, Column index 10)
    const isPublished = rows && rows[13] && rows[13][10] === "Publish";

    // IF UN-PUBLISHED - Matches the Result Page logic exactly
    if (!isPublished) {
        datesheetView.innerHTML = `
            <div class="section-title">Date Sheet</div>
            <div class="profile" style="text-align:center; padding: 50px 20px;">
                <h3 style="color: #666;">No Datesheet to show</h3>
            </div>
            <button class="back-btn" onclick="showView('view-dashboard')">← Back to Dashboard</button>`;
        return;
    }

    // IF PUBLISHED - Logic to fetch and display the table
    const examType = rows[0]?.[1] || "Examination"; 
    
    // Re-insert the original structure for the published view
    datesheetView.innerHTML = `
        <div class="section-title" id="ds-title">Date Sheet: ${examType}</div>
        <div class="table-container">
            <table>
                <thead><tr><th>Date</th><th>Subject</th></tr></thead>
                <tbody id="dsBody"></tbody>
            </table>
        </div>
        <button class="back-btn" onclick="showView('view-dashboard')">← Back to Dashboard</button>`;

    let classCol = -1;
    for(let j=1; j<=15; j++) { 
        if(rows[1] && rows[1][j] == studentClass) { classCol = j; break; } 
    }
    
    let html = "";
    if(classCol !== -1) {
        if(examType.includes("Half Yearly") || examType.includes("Annual")) {
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
    
    const bodyEl = document.getElementById("dsBody");
    if(bodyEl) bodyEl.innerHTML = html || "<tr><td colspan='2'>Nothing to show</td></tr>";
}
function setupPaymentLink(amount, btnId) {
    const btn = document.getElementById(btnId); if(!btn) return;
    btn.onclick = () => {
        if (amount <= 0) return alert("Enter amount > 0");
        const note = encodeURIComponent(`${document.getElementById("adm").innerText} ${document.getElementById("studentName").innerText} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amount}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const msg = encodeURIComponent(`Hello, I have completed the payment.\nAdmission No: ${document.getElementById("adm").innerText}\nName: ${document.getElementById("studentName").innerText}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    const b1 = document.getElementById("sendScreenshotBalanceBtn"), b2 = document.getElementById("sendScreenshotCalcBtn");
    if(b1) b1.onclick = handler; if(b2) b2.onclick = handler;
}

function showNotification() {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; max-width:400px; width:100%; text-align:center;"><h3 style="color:#0b3d91;">📢 School Notice</h3><p style="white-space:pre-wrap; text-align:left; font-size:14px;">${globalNotification}</p><button onclick="this.parentElement.parentElement.remove()" style="background:#0b3d91; color:white; border:none; padding:10px 20px; border-radius:5px;">Close</button></div>`;
    document.body.appendChild(overlay);
}

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
// Add this at the very end of script.js
window.addEventListener('DOMContentLoaded', () => {
    // Check if the app is running in "standalone" mode (installed PWA)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const displayMode = isPWA ? 'PWA' : 'Browser';
    
    if (typeof gtag === 'function') {
        gtag('event', 'app_launch', {
            'display_mode': displayMode
        });
    }
});

// This listens for the mobile hardware back button
window.onpopstate = function(event) {
    if (document.getElementById("portal").style.display === "block") {
        const current = getCurrentVisibleView();
        // If the user is in a sub-page, take them back to the dashboard
        if (current !== 'view-dashboard') {
            showView('view-dashboard', true);
        }
    }
};
