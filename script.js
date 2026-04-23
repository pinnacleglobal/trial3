// ... (Keep sheetID, apiKey, and sheets constant from previous version)

// Optimized renderFees with Bold Blue Labels for Mobile Cards
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
            
            // Desktop Table
            tableHtml += `<tr><td>${r[1]||''}</td><td>${r[0]||''}</td><td>₹${amt}</td><td>${r[6]||''}</td><td>${r[7]||''}</td><td>${r[8]||''}</td><td>${r[9]||''}</td><td>${r[10]||''}</td><td>${r[11]||''}</td></tr>`;
            
            // Mobile Cards with Bold Blue Labels
            cardsHtml += `<div class="fee-card">
                <div><span class="card-label">Date:</span> ${r[1]||''}</div>
                <div><span class="card-label">Slip Number:</span> ${r[0]||''}</div>
                <div><span class="card-label">Amount Paid:</span> ₹${amt}</div>
                <div><span class="card-label">Fee Type:</span> ${r[6]||''}</div>
                <div><span class="card-label">Session:</span> ${r[7]||''}</div>
                <div><span class="card-label">Tuition Fee Months:</span> ${r[8]||''}</div>
                <div><span class="card-label">Transport Fee Months:</span> ${r[9]||''}</div>
                <div><span class="card-label">Exam Fee Months:</span> ${r[10]||''}</div>
                <div><span class="card-label">Payment Mode:</span> ${r[11]||''}</div>
            </div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records found</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "No records found";
    
    // Summary and Balance Logic (Remains optimized)
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

// ... (Keep login, handlePermissions, populateStudentProfile as they were)
