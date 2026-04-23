const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

// Pre-encoding sheet names
const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice")
};

let originalDiscount = 0;
let globalNotification = "No notification to show";

async function login() {
    const code = document.getElementById("loginCode").value.trim();
    if (!code) { alert("Enter Login Code"); return; }
    
    document.getElementById("loginBtn").disabled = true;
    document.getElementById("loader").style.display = "block";

    try {
        // --- PERFORMANCE: Parallel Fetching ---
        // We start all requests at the exact same time
        const urls = [
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.aw}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.master}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.fees}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`
        ];

        const [awRes, masterRes, feesRes, dsRes] = await Promise.all(urls.map(url => fetch(url)));
        const [awData, masterData, feesData, dsData] = await Promise.all([
            awRes.json(), masterRes.json(), feesRes.json(), dsRes.json()
        ]);

        // 1. Validate Login from AW Sheet
        const student = awData.values?.find(r => r[29] && r[29].trim() === code);
        if (!student) { throw new Error("Invalid Login Code"); }
        if (student[31]?.toUpperCase() === "TRUE") { throw new Error("Login Blocked."); }

        // 2. Extract Data
        const mRow = masterData.values?.find(r => r[1] == student[1]);
        const fRows = feesData.values || [];
        const dsRows = dsData.values || [];

        // 3. Populate All Views Simultaneously
        handlePermissions(dsRows);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, fRows);
        setupDateSheet(dsRows, mRow[14]);

        // 4. UI Switch
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        setupSendScreenshotButtons();

    } catch (e) {
        alert(e.message || "Error loading data.");
        document.getElementById("loader").style.display = "none";
        document.getElementById("loginBtn").disabled = false;
    }
}

function handlePermissions(rows) {
    const dsStatus = rows[13]?.[10]; // K14
    const resStatus = rows[15]?.[10]; // K16
    const notifStatus = rows[19]?.[10]; // K20
    
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

function renderFees(adm, mData, fRows) {
    let monthly = parseFloat(mData[4]) || 0;
    let remain = parseFloat(mData[3]) || 0;
    let disc = parseFloat(mData[5]) || 0;
    originalDiscount = disc;
    
    let tableHtml = "", cardsHtml = "", totalPaid = 0;
    
    // Efficiently filter and map in one go
    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") totalPaid += amt;
            
            const row = `<tr><td>${r[1]}</td><td>${r[0]}</td><td>₹${amt}</td><td>${r[6]}</td><td>${r[7]}</td><td>${r[8]}</td><td>${r[9]}</td><td>${r[10]}</td><td>${r[11]}</td></tr>`;
            tableHtml += row;
            
            cardsHtml += `<div class="fee-card">
                <div><b>Date:</b> ${r[1]}</div><div><b>Slip:</b> ${r[0]}</div><div><b>Amount:</b> ₹${amt}</div>
                <div><b>Type:</b> ${r[6]}</div><div><b>Session:</b> ${r[7]}</div>
                <div><b>Tuition Months:</b> ${r[8]}</div><div><b>Transport Months:</b> ${r[9]}</div>
                <div><b>Exam Months:</b> ${r[10]}</div><div><b>Mode:</b> ${r[11]}</div>
            </div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml;
    document.getElementById("feeCards").innerHTML = cardsHtml;
    
    // Final Summary Math
    let totalFee = ((monthly - disc) * (parseFloat(mData[6]) || 0)) + ((parseFloat(mData[7]) || 0) * (parseFloat(mData[8]) || 0)) + (parseFloat(mData[9]) || 1000) + remain;
    let balance = Math.round(totalFee - totalPaid);

    document.getElementById("totalPaid").innerText = "₹" + totalPaid;
    const balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance;
    balEl.style.color = balance > 0 ? "red" : "green";
    
    // Fill basic structure info...
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    // ... Add other static fields here ...

    setupPaymentLink(balance, "payBalanceBtn");
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
    
    // Lazy Load Image
    if (aw[28]) {
        const fileId = aw[28].match(/[-\w]{25,}/); // Faster regex match for Drive ID
        if (fileId) {
            const img = document.getElementById("studentPhoto");
            img.src = `https://drive.google.com/thumbnail?id=${fileId[0]}&sz=w500`;
            img.onload = () => img.style.display = "inline-block";
        }
    }
}

// ... Keep showView, setupDateSheet, and Screenshot buttons the same as previous logic ...

function showView(viewId) {
    ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'].forEach(v => {
        document.getElementById(v).style.display = (v === viewId) ? 'block' : 'none';
    });
}

function showNotification() { alert("📢 School Notice:\n\n" + globalNotification); }

document.getElementById("loginBtn").onclick = login;
