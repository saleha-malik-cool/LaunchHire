import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_YOUR") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const $ = (selector) => document.querySelector(selector);
const dialog = $("#authDialog");
const authForm = $("#authForm");
const fullName = $("#fullName");
const emailInput = $("#email");
const passwordInput = $("#password");
const accountRole = $("#accountRole");
const startupFields = $("#startupFields");
const startupName = $("#startupName");
const startupWebsite = $("#startupWebsite");
const startupLocation = $("#startupLocation");
const jobGrid = $("#jobGrid");
const startupGrid = $("#startupGrid");
const searchInput = $("#searchInput");
const locationFilter = $("#locationFilter");
const resultsCount = $("#resultsCount");
const loadMoreBtn = $("#loadMoreBtn");
let authMode = "signup";
let currentUser = null;
let currentProfile = null;
let currentJobs = [];
let editingJobId = null;
let showAll = false;
let activeQuery = "";
const savedJobs = new Set();

const demoJobs = [
 {job_id:-1,title:"Frontend Developer",company:"Nova Labs",sector:"Technology",location:"Delhi NCR",salary:"₹6–10 LPA",description:"Build intuitive digital experiences for a growing product team."},
 {job_id:-2,title:"Product Design Intern",company:"Morrow Studio",sector:"Design",location:"Remote",salary:"₹15–25k/mo",description:"Help shape thoughtful experiences from idea to launch."},
 {job_id:-3,title:"Data Analyst",company:"FinNest",sector:"Fintech",location:"Bengaluru",salary:"₹5–8 LPA",description:"Turn data into insights that help people make smarter decisions."},
 {job_id:-4,title:"Growth Marketing Intern",company:"GoodRoots",sector:"Sustainability",location:"Delhi NCR",salary:"₹12–20k/mo",description:"Help a mission-led brand grow."},
 {job_id:-5,title:"Backend Developer",company:"OrbitPay",sector:"Fintech",location:"Remote",salary:"₹8–12 LPA",description:"Build reliable services for digital payments."},
 {job_id:-6,title:"AI Research Intern",company:"Nova Labs",sector:"Technology",location:"Bengaluru",salary:"₹20–35k/mo",description:"Prototype useful AI tools with a curious team."}
];
const demoStartups = [
 {startup_name:"Nova Labs",location:"Technology · AI",website:"Building practical tools for everyday work."},
 {startup_name:"Morrow Studio",location:"Design · Creative",website:"A design-first team creating digital products."},
 {startup_name:"FinNest",location:"Fintech · Finance",website:"Making personal finance approachable."}
];

function toast(message) {
 const el = $("#toast"); el.textContent = message; el.classList.add("show");
 clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}
function escapeHTML(value = "") {
 return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function updateStartupFields() {
 const show = authMode === "signup" && accountRole.value === "recruiter";
 startupFields.hidden = !show;
 startupName.required = show;
}
accountRole.addEventListener("change", updateStartupFields);
function openAuth(mode) {
 authMode = mode;
 $("#modalEyebrow").textContent = mode === "signup" ? "WELCOME ABOARD" : "WELCOME BACK";
 $("#modalTitle").textContent = mode === "signup" ? "Create your account" : "Log in to LaunchHire";
 $("#authSubmit").textContent = mode === "signup" ? "Create account" : "Log in";
 $(".modal-description").textContent = mode === "signup" ? "Start building your next chapter." : "Pick up where you left off.";
 fullName.closest("label").hidden = mode !== "signup";
 accountRole.closest("label").hidden = mode !== "signup";
 startupFields.hidden = true;
 fullName.required = mode === "signup";
 updateStartupFields();
 $("#authNote").textContent = configured ? "Your account is securely managed by Supabase Auth." : "First add your Supabase URL and publishable key in config.js.";
 dialog.showModal();
}
$("#loginBtn").addEventListener("click", () => openAuth("login"));
$("#signupBtn").addEventListener("click", () => openAuth("signup"));
$("#ctaSignup").addEventListener("click", () => openAuth("signup"));
$(".modal-close").addEventListener("click", e => { e.preventDefault(); dialog.close(); });

async function loadJobs() {
 if (!supabase) { currentJobs = demoJobs; renderJobs(); renderStartups(demoStartups); return; }
 const { data, error } = await supabase.from("jobs").select("job_id, title, description, location, startup_id, startups(startup_name)").order("job_id", {ascending:false});
 if (error) { console.error(error); toast("Could not load jobs. Check SQL setup and RLS policies."); currentJobs = []; }
 else currentJobs = (data || []).map(row => ({...row, company:row.startups?.startup_name || "Startup", sector:"Startup", salary:"Salary not specified"}));
 renderJobs();
 const { data: startupData, error: startupError } = await supabase.from("startups").select("startup_id,startup_name,website,location").order("startup_id", {ascending:false}).limit(6);
 if (!startupError) renderStartups(startupData || []);
}
function renderJobs() {
 const query = (activeQuery || searchInput.value).trim().toLowerCase();
 const location = locationFilter.value;
 const filtered = currentJobs.filter(job => {
  const text = [job.title,job.company,job.sector,job.description].join(" ").toLowerCase();
  return (!query || text.includes(query)) && (!location || job.location === location);
 });
 const visible = showAll ? filtered : filtered.slice(0,6);
 resultsCount.textContent = `${filtered.length} role${filtered.length === 1 ? "" : "s"}`;
 loadMoreBtn.style.display = filtered.length > 6 ? "inline-flex" : "none";
 loadMoreBtn.textContent = showAll ? "Show fewer roles ↑" : "Show all opportunities →";
 if (!visible.length) { jobGrid.innerHTML = '<div class="empty-state">No jobs found yet. Recruiters can publish the first opportunity from their workspace.</div>'; return; }
 jobGrid.innerHTML = visible.map(job => `<article class="job-card">
  <div class="job-card-top"><span class="company-logo">${escapeHTML((job.company || "S").slice(0,1).toUpperCase())}</span><div class="company-name"><strong>${escapeHTML(job.company)}</strong>${escapeHTML(job.sector || "Startup")}</div>
  <button class="save-job ${savedJobs.has(job.job_id) ? "saved" : ""}" data-save="${job.job_id}" aria-label="Save job">${savedJobs.has(job.job_id) ? "♥" : "♡"}</button></div>
  <h3>${escapeHTML(job.title)}</h3><p class="job-desc">${escapeHTML(job.description || "Explore this opportunity with the startup.")}</p>
  <div class="job-meta"><span>⌖ ${escapeHTML(job.location || "Location flexible")}</span><span>Startup role</span></div>
  <div class="job-card-bottom"><div class="salary">${escapeHTML(job.salary || "Discussed during hiring")}<small>Salary / stipend</small></div><button class="apply-link" data-apply="${job.job_id}">View & apply ↗</button></div>
 </article>`).join("");
}
function renderStartups(items) {
 const data = items.length ? items : (supabase ? [] : demoStartups);
 if (!data.length) { startupGrid.innerHTML = '<div class="empty-state">Startup profiles will appear here when recruiters register.</div>'; return; }
 startupGrid.innerHTML = data.map(s => `<article class="startup-card"><div class="startup-card-header"><span class="company-logo">${escapeHTML((s.startup_name || "S").slice(0,1).toUpperCase())}</span><div><h3>${escapeHTML(s.startup_name)}</h3><span class="startup-sector">${escapeHTML(s.location || "Startup")}</span></div></div><p>${escapeHTML(s.website || "Growing team looking for great talent.")}</p><div class="startup-card-bottom"><span>Startup profile</span><span class="hiring-tag">● LaunchHire</span></div></article>`).join("");
}
jobGrid.addEventListener("click", async event => {
 const save = event.target.closest("[data-save]");
 const apply = event.target.closest("[data-apply]");
 if (save) { const id = Number(save.dataset.save); savedJobs.has(id) ? savedJobs.delete(id) : savedJobs.add(id); renderJobs(); return; }
 if (apply) {
  const id = Number(apply.dataset.apply);
  if (!supabase || id < 0) { toast("Connect Supabase and log in to apply to a real job."); return; }
  if (!currentUser) { openAuth("login"); toast("Log in as a job seeker to apply."); return; }
  if (currentProfile?.role !== "seeker") { toast("Only job seekers can apply to jobs."); return; }
  const { error } = await supabase.from("applications").insert({seeker_id:currentUser.id, job_id:id});
  if (error) toast(error.code === "23505" ? "You have already applied to this job." : error.message);
  else { toast("Application submitted successfully!"); await loadMyApplications(); }
 }
});
$("#searchBtn").addEventListener("click", () => { activeQuery = ""; showAll = false; renderJobs(); });
searchInput.addEventListener("keydown", e => { if (e.key === "Enter") { activeQuery = ""; showAll = false; renderJobs(); } });
locationFilter.addEventListener("change", () => { showAll = false; renderJobs(); });
document.querySelectorAll(".filter-chip").forEach(chip => chip.addEventListener("click", () => {
 document.querySelectorAll(".filter-chip").forEach(c=>c.classList.remove("selected")); chip.classList.add("selected"); searchInput.value=chip.dataset.query; activeQuery=chip.dataset.query; showAll=false; renderJobs(); $("#jobs").scrollIntoView({behavior:"smooth"});
}));
loadMoreBtn.addEventListener("click", () => { showAll = !showAll; renderJobs(); });
$("#viewAllJobs").addEventListener("click", () => { showAll=true; activeQuery=""; searchInput.value=""; locationFilter.value=""; renderJobs(); });
$("#viewStartups").addEventListener("click", e => { e.preventDefault(); $("#startups").scrollIntoView({behavior:"smooth"}); });
$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
document.querySelectorAll("#mainNav a").forEach(a => a.addEventListener("click", () => $("#mainNav").classList.remove("open")));

async function submitAuth(event) {
 event.preventDefault();
 if (!supabase) { toast("Add Supabase URL and publishable key in config.js first."); return; }
 const name = fullName.value.trim(), email = emailInput.value.trim(), password = passwordInput.value, role = accountRole.value;
 if (authMode === "signup" && !name) return toast("Please enter your name.");
 if (password.length < 6) return toast("Password must be at least 6 characters.");
 if (authMode === "signup" && role === "recruiter" && !startupName.value.trim()) return toast("Please enter your startup name.");
 let result;
 if (authMode === "signup") {
  result = await supabase.auth.signUp({email,password,options:{data:{full_name:name,role,startup_name:startupName.value.trim(),website:startupWebsite.value.trim(),location:startupLocation.value.trim()}}});
 } else result = await supabase.auth.signInWithPassword({email,password});
 if (result.error) { toast(result.error.message); return; }
 authForm.reset(); dialog.close();
 if (authMode === "signup" && !result.data.session) toast("Account created. Check your email to confirm, then log in.");
 else toast(authMode === "signup" ? "Account created successfully!" : "Welcome back!");
 await refreshSession();
}
authForm.addEventListener("submit", submitAuth);

async function refreshSession() {
 if (!supabase) return;
 const {data:{session}} = await supabase.auth.getSession();
 currentUser = session?.user || null; currentProfile = null;
 if (currentUser) {
  const {data} = await supabase.from("profiles").select("user_id,full_name,email,role").eq("user_id",currentUser.id).maybeSingle();
  currentProfile = data;
 }
 const signupBtn = $("#signupBtn"), loginBtn = $("#loginBtn");
 if (currentUser) {
  signupBtn.textContent = "My workspace"; signupBtn.onclick = () => { $("#managePanel").hidden = false; $("#managePanel").scrollIntoView({behavior:"smooth"}); };
  loginBtn.textContent = "Log out"; loginBtn.onclick = async () => { await supabase.auth.signOut(); currentUser=null; currentProfile=null; signupBtn.textContent="Sign up"; signupBtn.onclick=()=>openAuth("signup"); loginBtn.textContent="Log in"; loginBtn.onclick=()=>openAuth("login"); $("#managePanel").hidden=true; toast("Logged out."); await loadJobs(); };
  $("#managePanel").hidden = false;
  const isRecruiter = currentProfile?.role === "recruiter";
  $("#jobForm").hidden = !isRecruiter;
  $("#jobFormTitle").textContent = isRecruiter ? "Post a job" : "Job seeker workspace";
  await loadMyApplications();
  await loadManagedJobs();
 } else {
  signupBtn.textContent="Sign up"; signupBtn.onclick=()=>openAuth("signup");
  loginBtn.textContent="Log in"; loginBtn.onclick=()=>openAuth("login");
  $("#managePanel").hidden=true;
 }
}
supabase?.auth.onAuthStateChange(() => { setTimeout(() => refreshSession(), 0); });

async function getRecruiterStartupId() {
 const {data,error} = await supabase.from("recruiters").select("startup_id").eq("user_id",currentUser.id).maybeSingle();
 if (error) throw error; if (!data) throw new Error("Your recruiter profile was not found. Try signing out and in again."); return data.startup_id;
}
$("#jobForm").addEventListener("submit", async e => {
 e.preventDefault();
 if (!supabase || !currentUser || currentProfile?.role !== "recruiter") return toast("Log in as a recruiter first.");
 try {
  const payload = {title:$("#jobTitle").value.trim(),description:$("#jobDescription").value.trim() || null,location:$("#jobLocation").value.trim() || null};
  if (editingJobId) {
   const {error} = await supabase.from("jobs").update(payload).eq("job_id",editingJobId);
   if (error) throw error;
   if ($("#jobSalary").value.trim()) {
    const {error:salError} = await supabase.from("job_salary_ranges").upsert({job_id:editingJobId,salary_range:$("#jobSalary").value.trim()}); if (salError) throw salError;
   }
   toast("Job updated.");
  } else {
   const startup_id = await getRecruiterStartupId();
   const {data,error} = await supabase.from("jobs").insert({...payload,startup_id}).select("job_id").single();
   if (error) throw error;
   if ($("#jobSalary").value.trim()) { const {error:salError} = await supabase.from("job_salary_ranges").insert({job_id:data.job_id,salary_range:$("#jobSalary").value.trim()}); if (salError) throw salError; }
   toast("Job published!");
  }
  resetJobForm(); await loadJobs(); await loadManagedJobs();
 } catch (error) { console.error(error); toast(error.message || "Could not save job. Check RLS policies."); }
});
function resetJobForm() { editingJobId=null; $("#jobForm").reset(); $("#jobFormTitle").textContent="Post a job"; $("#jobSaveButton").textContent="Publish job"; $("#jobCancelEdit").hidden=true; }
$("#jobCancelEdit").addEventListener("click", resetJobForm);
async function loadManagedJobs() {
 const box = $("#manageJobsList");
 if (!supabase || !currentUser || currentProfile?.role !== "recruiter") { box.innerHTML='<p class="muted">Recruiter job posts appear here.</p>'; return; }
 const {data,error} = await supabase.from("jobs").select("job_id,title,location,description,startup_id").order("job_id",{ascending:false});
 if (error) { box.innerHTML=`<p class="muted">${escapeHTML(error.message)}</p>`; return; }
 const {data:recruiter} = await supabase.from("recruiters").select("startup_id").eq("user_id",currentUser.id).maybeSingle();
 const mine=(data||[]).filter(j=>j.startup_id===recruiter?.startup_id);
 box.innerHTML=mine.length?mine.map(j=>`<div class="managed-job"><div><strong>${escapeHTML(j.title)}</strong><p>${escapeHTML(j.location||"Location flexible")}</p></div><div class="managed-job-actions"><button data-edit-job="${j.job_id}">Edit</button><button data-delete-job="${j.job_id}">Delete</button></div></div>`).join(""):'<p class="muted">You have not posted any jobs yet.</p>';
 box.querySelectorAll("[data-edit-job]").forEach(btn=>btn.addEventListener("click",()=>{const j=mine.find(x=>x.job_id===Number(btn.dataset.editJob)); editingJobId=j.job_id; $("#jobTitle").value=j.title; $("#jobDescription").value=j.description||""; $("#jobLocation").value=j.location||""; $("#jobFormTitle").textContent="Edit job"; $("#jobSaveButton").textContent="Save changes"; $("#jobCancelEdit").hidden=false; $("#jobForm").scrollIntoView({behavior:"smooth"});}));
 box.querySelectorAll("[data-delete-job]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Delete this job and its related applications?"))return; const {error}=await supabase.from("jobs").delete().eq("job_id",Number(btn.dataset.deleteJob)); if(error)toast(error.message);else{toast("Job deleted.");await loadJobs();await loadManagedJobs();}}));
}
async function loadMyApplications() {
 const box=$("#myApplications");
 if (!supabase || !currentUser || currentProfile?.role !== "seeker") { box.innerHTML='<p class="muted">Your applications will appear here when you sign in as a job seeker.</p>'; return; }
 const {data,error}=await supabase.from("applications").select("application_id,applied_date,status,jobs(title,startups(startup_name))").eq("seeker_id",currentUser.id).order("application_id",{ascending:false});
 if(error){box.innerHTML=`<p class="muted">${escapeHTML(error.message)}</p>`;return;}
 box.innerHTML=(data||[]).length?data.map(a=>`<div class="application-row"><div><strong>${escapeHTML(a.jobs?.title||"Job")}</strong><p class="muted">${escapeHTML(a.jobs?.startups?.startup_name||"Startup")} · ${escapeHTML(a.status)}</p></div><button data-delete-application="${a.application_id}">Withdraw</button></div>`).join(""):'<p class="muted">You have not applied to any jobs yet.</p>';
 box.querySelectorAll("[data-delete-application]").forEach(btn=>btn.addEventListener("click",async()=>{const {error}=await supabase.from("applications").delete().eq("application_id",Number(btn.dataset.deleteApplication));if(error)toast(error.message);else{toast("Application withdrawn.");await loadMyApplications();}}));
}

if (!configured) console.warn("LaunchHire: add Supabase URL and publishable key to config.js.");
await loadJobs();
if (supabase) await refreshSession();
