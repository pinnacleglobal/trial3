const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const masterSheet = "Master Data 2026";
const feesSheet = "Fees Collection";
const awSheet = "AW";
const dsSheet = "DS n Notice";

let studentClass = "";
let originalDiscount = 0;

/* LOGIN */
async function login() {

const code = document.getElementById("loginCode").value.trim();
if (!code) { alert("Enter Login Code"); return; }

document.getElementById("loader").style.display = "block";

/* AW */
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${awSheet}?key=${apiKey}`);
let rows = (await resp.json()).values;

let admission="", studentName="", father="", mother="", phone="", address="", photo="";

for (let i = 1; i < rows.length; i++) {
let r = rows[i];
if (r[29] == code) {
admission = r[1];
studentName = r[3];
father = r[6];
mother = r[5];
phone = r[22];
address = r[7];
photo = r[28];
break;
}
}

if (!admission) { alert("Invalid Login Code"); return; }

/* MASTER */
resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${masterSheet}?key=${apiKey}`);
rows = (await resp.json()).values;

let monthly=0, tuitionMonths=0, transport=0, transportMonths=0, prev=0, discount=0, examFee=1000;

for (let i = 1; i < rows.length; i++) {
let r = rows[i];
if (r[1] == admission) {
studentClass = r[14];
monthly = parseFloat(r[4]) || 0;
tuitionMonths = r[6];
transport = parseFloat(r[7]) || 0;
transportMonths = r[8];
prev = parseFloat(r[3]) || 0;
discount = parseFloat(r[5]) || 0;
originalDiscount = discount;
examFee = parseFloat(r[9]) || 1000;
}
}

/* PHOTO FIX */
if (photo) {
let fileId="";
if(photo.includes("id=")) fileId = photo.split("id=")[1].split("&")[0];
if(photo.includes("/d/")) fileId = photo.split("/d/")[1].split("/")[0];

if(fileId){
let img=document.getElementById("studentPhoto");
img.src=`https://lh3.googleusercontent.com/d/${fileId}`;
img.style.display="block";
}
}

/* SET DETAILS */
document.getElementById("studentName").innerText = studentName;
document.getElementById("welcomeName").innerText = "Welcome, " + studentName;
document.getElementById("class").innerText = studentClass;
document.getElementById("adm").innerText = admission;
document.getElementById("father").innerText = father;
document.getElementById("mother").innerText = mother;
document.getElementById("phone").innerText = phone;
document.getElementById("address").innerText = address;

/* FEES */
resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${feesSheet}?key=${apiKey}`);
rows = (await resp.json()).values;

let table="", totalPaid=0;

for (let i = 1; i < rows.length; i++) {
let r = rows[i];
if (r[2] == admission) {
let amount = parseFloat(r[5]) || 0;
totalPaid += amount;

table += `<tr>
<td>${r[1]}</td>
<td>${r[0]}</td>
<td>₹${amount}</td>
<td>${r[6]}</td>
<td>${r[7]}</td>
</tr>`;
}
}

let totalFee = ((monthly - discount) * tuitionMonths) + (transport * transportMonths) + examFee + prev;
let balance = Math.round(totalFee - totalPaid);

/* SET FEES */
document.getElementById("feeTable").innerHTML = table;
document.getElementById("monthlyTuition").innerText = "₹"+monthly;
document.getElementById("tuitionMonths").innerText = tuitionMonths;
document.getElementById("transportFees").innerText = "₹"+transport;
document.getElementById("transportMonths").innerText = transportMonths;
document.getElementById("prevRemain").innerText = "₹"+prev;
document.getElementById("discount").innerText = "₹"+Math.round(discount);
document.getElementById("totalPaid").innerText = "₹"+totalPaid;
document.getElementById("examFee").innerText = "₹"+examFee;
document.getElementById("feeBalance").innerText = "₹"+balance;

/* SHOW */
document.getElementById("loginBox").style.display="none";
document.getElementById("loader").style.display="none";
document.getElementById("dashboard").style.display="block";

/* CHECK PUBLISH */
checkPublish();
}

/* NAVIGATION */
function openFees(){switchPage("feesPage")}
function openAttendance(){switchPage("attendancePage")}
function openDateSheet(){loadDateSheet();switchPage("dsPage")}
function openResult(){switchPage("resultPage")}

function switchPage(id){
document.getElementById("dashboard").style.display="none";
document.getElementById(id).style.display="block";
}

function goBack(){
["feesPage","attendancePage","dsPage","resultPage"].forEach(id=>{
document.getElementById(id).style.display="none";
});
document.getElementById("dashboard").style.display="block";
}

/* DATE SHEET */
async function loadDateSheet(){
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

let exam = data[0][1];
let col = getClassIndex();

let html = `<h3>${exam}</h3>`;

for(let i=6;i<=11;i++){
if(data[i][0]){
html += `<div>${data[i][0]} - ${data[i][col]}</div>`;
}
}

document.getElementById("dsContent").innerHTML = html;
}

/* CLASS MATCH */
function getClassIndex(){
let arr=["Nur","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"];
return arr.indexOf(studentClass)+1;
}

/* PUBLISH */
async function checkPublish(){
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

if(data[13][10]!="Publish"){
document.getElementById("dsBtn").classList.add("disabled");
document.getElementById("dsBtn").onclick=null;
}

if(data[15][10]!="Publish"){
document.getElementById("resultBtn").classList.add("disabled");
document.getElementById("resultBtn").onclick=null;
}
}

/* NOTIFICATION */
async function openNotification(){
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

if(data[19][10]=="Publish"){
alert(data[1][9]);
}else{
alert("No notification to show");
}
}

document.getElementById("loginBtn").addEventListener("click", login);
