const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const masterSheet = "Master Data 2026";
const awSheet = "AW";
const dsSheet = "DS n Notice";

let studentClass = "";

/* LOGIN */
async function login(){
let code = document.getElementById("loginCode").value.trim();
if(!code){alert("Enter code");return;}

document.getElementById("loader").style.display="block";

let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${awSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

let admission="", name="";

for(let i=1;i<data.length;i++){
if(data[i][29]==code){
admission=data[i][1];
name=data[i][3];
break;
}
}

if(!admission){alert("Invalid");return;}

/* MASTER */
resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${masterSheet}?key=${apiKey}`);
data = (await resp.json()).values;

for(let i=1;i<data.length;i++){
if(data[i][1]==admission){
studentClass = data[i][14];
break;
}
}

/* UI */
document.getElementById("studentName").innerText=name;
document.getElementById("welcomeName").innerText="Welcome, "+name;
document.getElementById("adm").innerText=admission;
document.getElementById("class").innerText=studentClass;

document.getElementById("loginBox").style.display="none";
document.getElementById("loader").style.display="none";
document.getElementById("dashboard").style.display="block";

/* CHECK PUBLISH */
checkPublish();
}

/* NAVIGATION */
function openFees(){switchPage("feesPage")}
function openAttendance(){switchPage("attendancePage")}
function openDateSheet(){loadDateSheet(); switchPage("dsPage")}
function openResult(){switchPage("resultPage")}

function switchPage(page){
document.getElementById("dashboard").style.display="none";
document.getElementById(page).style.display="block";
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

let examType = data[0][1];
let classIndex = getClassIndex();

let html = `<h3>${examType}</h3>`;

if(examType.includes("PT")){
for(let i=6;i<=11;i++){
let date = data[i][0];
let subject = data[i][classIndex];
if(date && subject){
html += `<div>${date} - ${subject}</div>`;
}
}
}else{
html += "<b>Minor Exams</b>";
for(let i=3;i<=4;i++){
html += `<div>${data[i][0]} - ${data[i][classIndex]}</div>`;
}
html += "<b>Major Exams</b>";
for(let i=6;i<=11;i++){
html += `<div>${data[i][0]} - ${data[i][classIndex]}</div>`;
}
}

document.getElementById("dsContent").innerHTML = html;
}

/* CLASS COLUMN MATCH */
function getClassIndex(){
let classes = ["Nur","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"];
return classes.indexOf(studentClass) + 1;
}

/* PUBLISH CONTROL */
async function checkPublish(){
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

let dsStatus = data[13][10];
let resultStatus = data[15][10];

if(dsStatus!="Publish"){
document.getElementById("dsBtn").classList.add("disabled");
document.getElementById("dsBtn").onclick=null;
}

if(resultStatus!="Publish"){
document.getElementById("resultBtn").classList.add("disabled");
document.getElementById("resultBtn").onclick=null;
}
}

/* NOTIFICATION */
async function openNotification(){
let resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${dsSheet}?key=${apiKey}`);
let data = (await resp.json()).values;

let status = data[19][10];
let msg = data[1][9];

if(status=="Publish"){
alert(msg);
}else{
alert("No notification to show");
}
}
