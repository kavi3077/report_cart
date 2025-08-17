/* EEC Report Card Generator – PWA
   - 8 semesters x 6 subjects each (auto rendered)
   - Optional NPTEL + Additional Course rows per semester
   - PDF generation via html2canvas + jsPDF
*/

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const yearEl = $("#year"); yearEl.textContent = new Date().getFullYear();

const semContainer = $("#semContainer");
const reportRoot = $("#reportRoot");
const generatePdfBtn = $("#generatePdfBtn");
const printBtn = $("#printBtn");
const resetBtn = $("#resetBtn");
const installBtn = $("#installBtn");

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

resetBtn.addEventListener('click', () => {
  if (confirm("Clear all fields?")) {
    localStorage.removeItem('eecForm');
    location.reload();
  }
});

const SUBJECTS_PER_SEM = 6;
const SEMESTERS = 8;

function subjectRow(index){
  return `
  <tr>
    <td><input type="text" placeholder="MA330${index}" data-field="code"></td>
    <td><input type="text" placeholder="Subject ${index}" data-field="name"></td>
    <td><input type="number" min="0" max="100" placeholder="95" data-field="marks"></td>
    <td>
      <select data-field="grade">
        <option value="">—</option>
        <option>S</option><option>A</option><option>B</option>
        <option>C</option><option>D</option><option>E</option><option>F</option>
      </select>
    </td>
    <td><input type="number" min="0" max="5" step="0.5" placeholder="4" data-field="credits"></td>
  </tr>`;
}

function extraRow(label){
  return `
  <tr class="extra">
    <td><span class="badge">${label}</span></td>
    <td><input type="text" placeholder="${label} Course Name" data-field="name"></td>
    <td><input type="number" min="0" max="100" placeholder="90" data-field="marks"></td>
    <td>
      <select data-field="grade">
        <option value="">—</option>
        <option>S</option><option>A</option><option>B</option>
        <option>C</option><option>D</option><option>E</option><option>F</option>
      </select>
    </td>
    <td><input type="number" min="0" max="5" step="0.5" placeholder="0" data-field="credits"></td>
  </tr>`;
}

function renderSemesters(){
  for(let s=1; s<=SEMESTERS; s++){
    const semEl = document.createElement('div');
    semEl.className = 'sem';
    semEl.dataset.sem = s;
    semEl.innerHTML = `
      <div class="sem-header">
        <div class="sem-title">Semester ${s}</div>
        <div class="sem-actions">
          <button class="btn small secondary" data-add="nptel">+ NPTEL</button>
          <button class="btn small secondary" data-add="additional">+ Additional Course</button>
        </div>
      </div>
      <div class="sem-body">
        <table class="table">
          <thead>
            <tr><th>Code</th><th>Subject</th><th>Marks</th><th>Grade</th><th>Credits</th></tr>
          </thead>
          <tbody>
            ${Array.from({length: SUBJECTS_PER_SEM}, (_,i)=>subjectRow(i+1)).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Semester Totals</td>
              <td data-total="marks">0</td>
              <td data-total="grade">—</td>
              <td data-total="credits">0</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    semContainer.appendChild(semEl);
  }

  // attach add-extra handlers
  $$("#semesters [data-add]").forEach(btn=>{
    btn.addEventListener('click', e=>{
      const type = e.currentTarget.dataset.add;
      const sem = e.currentTarget.closest('.sem');
      const tbody = $("tbody", sem);
      tbody.insertAdjacentHTML('beforeend', extraRow(type === 'nptel' ? 'NPTEL' : 'Additional'));
    });
  });

  // recalc on input
  semContainer.addEventListener('input', updateAllTotals);
}
renderSemesters();

function updateAllTotals(){
  $$(".sem").forEach(sem=>{
    const rows = $$("tbody tr", sem);
    let marks=0, credits=0;
    rows.forEach(r=>{
      const m = parseFloat($('input[data-field="marks"]', r)?.value||0);
      const c = parseFloat($('input[data-field="credits"]', r)?.value||0);
      if(!isNaN(m)) marks += m;
      if(!isNaN(c)) credits += c;
    });
    $('[data-total="marks"]', sem).textContent = Math.round(marks);
    $('[data-total="credits"]', sem).textContent = Number(credits.toFixed(2));
  });
  saveState();
  renderPreview();
}

// Persist state
function collectState(){
  const state = {
    student: {
      name: $("#studentName").value.trim(),
      reg: $("#registerNo").value.trim(),
      dept: $("#department").value.trim(),
      prog: $("#programme").value.trim(),
      batch: $("#batch").value.trim(),
      advisor: $("#advisor").value.trim(),
    },
    semesters: []
  };
  $$(".sem").forEach(sem=>{
    const sObj = { index: parseInt(sem.dataset.sem), rows: [] };
    $$("tbody tr", sem).forEach(tr=>{
      const isExtra = tr.classList.contains('extra');
      sObj.rows.push({
        type: isExtra ? ($(".badge", tr).textContent) : "Subject",
        code: $('input[data-field="code"]', tr)?.value || "",
        name: $('input[data-field="name"]', tr)?.value || "",
        marks: $('input[data-field="marks"]', tr)?.value || "",
        grade: $('select[data-field="grade"]', tr)?.value || "",
        credits: $('input[data-field="credits"]', tr)?.value || ""
      });
    });
    state.semesters.push(sObj);
  });
  return state;
}
function saveState(){ localStorage.setItem('eecForm', JSON.stringify(collectState())); }
function loadState(){
  const raw = localStorage.getItem('eecForm'); if(!raw) return;
  try{
    const st = JSON.parse(raw);
    $("#studentName").value = st.student?.name || "";
    $("#registerNo").value = st.student?.reg || "";
    $("#department").value = st.student?.dept || "";
    $("#programme").value = st.student?.prog || "";
    $("#batch").value = st.student?.batch || "";
    $("#advisor").value = st.student?.advisor || "";

    st.semesters?.forEach(s=>{
      const sem = $(`.sem[data-sem="${s.index}"]`);
      const tbody = $("tbody", sem);
      // reset tbody
      tbody.innerHTML = "";
      s.rows.forEach((row, i)=>{
        const isExtra = row.type && row.type !== "Subject";
        if(isExtra){
          tbody.insertAdjacentHTML('beforeend', extraRow(row.type));
        }else{
          tbody.insertAdjacentHTML('beforeend', subjectRow(i+1));
        }
        const tr = $$("tr", tbody).slice(-1)[0];
        if(!isExtra){ $('input[data-field="code"]', tr).value = row.code || ""; }
        $('input[data-field="name"]', tr).value = row.name || "";
        $('input[data-field="marks"]', tr).value = row.marks || "";
        $('select[data-field="grade"]', tr).value = row.grade || "";
        $('input[data-field="credits"]', tr).value = row.credits || "";
      });
    });
  }catch(e){ console.warn("Load failed", e); }
}
loadState();
updateAllTotals();

// Preview (print/PDF target)
function renderPreview(){
  const st = collectState();
  const totalCredits = st.semesters.reduce((sum, s)=>{
    return sum + s.rows.reduce((acc, r)=> acc + (parseFloat(r.credits)||0), 0);
  }, 0);
  const sumMarks = st.semesters.reduce((sum, s)=>{
    return sum + s.rows.reduce((acc, r)=> acc + (parseFloat(r.marks)||0), 0);
  }, 0);

  reportRoot.innerHTML = `
    <div class="hdr">
      <img src="assets/logo.svg" alt="Logo">
      <div>
        <h2>EASWARI ENGINEERING COLLEGE</h2>
        <div class="badge">Consolidated Report Card</div>
        <p class="small muted">Generated on ${new Date().toLocaleString()}</p>
      </div>
    </div>
    <div class="kv" style="margin-top:10px">
      <div><strong>Student:</strong> ${st.student.name || "—"}</div>
      <div><strong>Register No.:</strong> ${st.student.reg || "—"}</div>
      <div><strong>Department:</strong> ${st.student.dept || "—"}</div>
      <div><strong>Programme:</strong> ${st.student.prog || "—"}</div>
      <div><strong>Batch:</strong> ${st.student.batch || "—"}</div>
      <div><strong>Advisor:</strong> ${st.student.advisor || "—"}</div>
    </div>
    ${st.semesters.map(s=>{
      const semMarks = s.rows.reduce((a,r)=>a+(parseFloat(r.marks)||0),0);
      const semCredits = s.rows.reduce((a,r)=>a+(parseFloat(r.credits)||0),0);
      return `
      <h3>Semester ${s.index} <span class="badge">Subjects: ${s.rows.length}</span></h3>
      <table class="table">
        <thead><tr><th>#</th><th>Type</th><th>Code</th><th>Subject</th><th>Marks</th><th>Grade</th><th>Credits</th></tr></thead>
        <tbody>
          ${s.rows.map((r,i)=>`
            <tr>
              <td>${i+1}</td>
              <td>${r.type || "Subject"}</td>
              <td>${r.code || "—"}</td>
              <td>${r.name || "—"}</td>
              <td>${r.marks || "—"}</td>
              <td>${r.grade || "—"}</td>
              <td>${r.credits || "—"}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="4">Semester Totals</td><td>${Math.round(semMarks)}</td><td>—</td><td>${Number(semCredits.toFixed(2))}</td></tr>
        </tfoot>
      </table>`;
    }).join('')}
    <h3>Overall Summary</h3>
    <table class="table">
      <tbody>
        <tr><td><strong>Total Marks (all semesters)</strong></td><td>${Math.round(sumMarks)}</td></tr>
        <tr><td><strong>Total Credits (all semesters)</strong></td><td>${Number(totalCredits.toFixed(2))}</td></tr>
      </tbody>
    </table>
  `;
}

// Print & PDF
printBtn.addEventListener('click', ()=>window.print());

generatePdfBtn.addEventListener('click', async ()=>{
  // ensure preview is up-to-date
  renderPreview();
  const { jsPDF } = window.jspdf;

  // Split reportRoot into chunks if it grows tall
  const A4_W = 210, A4_H = 297; // mm
  const pdf = new jsPDF({ unit:'mm', format:'a4' });

  // Render DOM to canvas
  const scale = Math.min(2, (window.devicePixelRatio || 1));
  const canvas = await html2canvas(reportRoot, { backgroundColor:'#ffffff', scale });
  const imgData = canvas.toDataURL('image/png');

  // Fit width, compute pages
  const pageW = A4_W - 20; // margins
  const pageH = A4_H - 20;
  const imgWmm = pageW;
  const imgHmm = canvas.height * (pageW * 3.779527559 / canvas.width) / 3.779527559; // px->mm
  let remainingHmm = imgHmm;
  let y = 10;

  let sx = 0, sy = 0, sWidth = canvas.width, sHeight = canvas.height;

  // Strategy: add the full image scaled; if height exceeds page, draw slices
  const pageCount = Math.ceil(imgHmm / pageH);
  for(let p=0; p<pageCount; p++){
    if(p>0) pdf.addPage();
    const sliceHeightPx = Math.min(canvas.height - sy, Math.floor(pageH * 3.779527559)); // mm->px
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sWidth, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    const pageImg = pageCanvas.toDataURL('image/png');
    pdf.addImage(pageImg, 'PNG', 10, 10, pageW, pageH);
    sy += sliceHeightPx;
    remainingHmm -= pageH;
  }

  const student = $("#studentName").value.trim() || "Report";
  pdf.save(`${student.replace(/\s+/g,'_')}_EEC_ReportCard.pdf`);
});
