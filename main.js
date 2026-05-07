// --- QUẢN LÝ THEME ---
function initTheme() {
    const savedTheme = localStorage.getItem('quiz-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('quiz-theme', next);
}

// --- BIẾN TOÀN CỤC ---
let questions = []; 
let questionBatches = []; 
let quizQuestions=[], answers=[], i=0;
let usedIndexes=new Set();
let countdown=null, timeLeft=null;
let savedQuestionCount=null, savedTimeMinutes=null;

// --- BIẾN QUẢN LÝ KHÁCH & IP ---
let guestPlayCount = 0;        
let hasGuestUploaded = false;  
const MAX_GUEST_PLAYS = 3;     
const MAX_GUEST_FILES = 1;     

// [MỚI] Biến lưu IP
let userIP = "Đang xác thực..."; 

// --- BIẾN QUẢN LÝ TIMEOUT & LOGIN ---
let nextQuestionTimeout = null; 
let delayTime = 800; 
let isLoggedIn = false; 
const SESSION_DURATION = 24 * 60 * 60 * 1000; 

// --- [MỚI] HÀM NHẬN DIỆN IP ---
async function detectUserIP() {
    try {
        // Kiểm tra xem đã lưu IP trong phiên trước chưa để đỡ gọi API nhiều lần
        const cachedIP = localStorage.getItem('visitor_ip');
        if (cachedIP) {
            userIP = cachedIP;
            updateAuthUI();
            console.log("👋 Chào mừng trở lại, IP:", userIP);
            return;
        }

        // Gọi API miễn phí để lấy IP public
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        
        if (data.ip) {
            userIP = data.ip;
            localStorage.setItem('visitor_ip', userIP); // Lưu lại IP
            updateAuthUI(); // Cập nhật giao diện
            console.log("📍 Đã nhận diện IP mới:", userIP);
        }
    } catch (error) {
        console.error("Không thể lấy IP:", error);
        userIP = "Ẩn danh / Offline";
        updateAuthUI();
    }
}

// --- HÀM LẤY MẬT KHẨU HIỆN TẠI ---
function getCurrentPassword() {
    return localStorage.getItem('quiz_admin_pass') || 'admin';
}

// --- QUẢN LÝ ĐĂNG NHẬP ---
function initLoginState() {
    const savedData = localStorage.getItem('quiz_auth_token');
    
    // Khôi phục trạng thái khách từ localStorage (nếu có)
    const savedGuestUpload = localStorage.getItem('guest_uploaded_status');
    if(savedGuestUpload === 'true') hasGuestUploaded = true;

    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            const now = Date.now();

            if (parsedData.status === 'logged_in' && parsedData.timestamp) {
                const elapsedTime = now - parsedData.timestamp;
                if (elapsedTime < SESSION_DURATION) {
                    isLoggedIn = true;
                    updateAuthUI();
                } else {
                    localStorage.removeItem('quiz_auth_token');
                    isLoggedIn = false;
                    updateAuthUI();
                }
            }
        } catch (e) {
            localStorage.removeItem('quiz_auth_token');
        }
    }
}

function toggleLoginModal() {
    if (isLoggedIn) {
        if(confirm("Bạn có chắc muốn đăng xuất?")) {
            performLogout();
        }
    } else {
        document.getElementById('loginModal').classList.toggle('active');
    }
}

function performLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const currentPass = getCurrentPassword();

    if (u === 'admin' && p === currentPass) {
        isLoggedIn = true;
        
        const sessionData = {
            status: 'logged_in',
            timestamp: Date.now()
        };
        localStorage.setItem('quiz_auth_token', JSON.stringify(sessionData));
        
        document.getElementById('loginModal').classList.remove('active');
        updateAuthUI();
        alert(`✅ Đăng nhập thành công!\nIP Quản trị viên: ${userIP}`);
    } else {
        alert("❌ Sai tài khoản hoặc mật khẩu!");
    }
}

function performLogout() {
    isLoggedIn = false;
    localStorage.removeItem('quiz_auth_token'); 
    
    // Reset trạng thái khách để UX tốt hơn, nhưng vẫn giữ IP
    hasGuestUploaded = false; 
    guestPlayCount = 0;
    localStorage.removeItem('guest_uploaded_status');

    updateAuthUI();
    alert("Đã đăng xuất.");
}

function changePassword() {
    if (!isLoggedIn) return alert("Vui lòng đăng nhập trước!");
    const oldPass = prompt("🔒 Nhập mật khẩu cũ:");
    if (oldPass === null) return; 
    if (oldPass !== getCurrentPassword()) return alert("❌ Mật khẩu cũ không đúng!");
    const newPass = prompt("🔑 Nhập mật khẩu mới:");
    if (newPass === null) return;
    if (newPass.trim() === "") return alert("❌ Mật khẩu không được để trống!");
    const confirmPass = prompt("🔁 Nhập lại mật khẩu mới:");
    if (newPass !== confirmPass) return alert("❌ Mật khẩu xác nhận không khớp!");
    localStorage.setItem('quiz_admin_pass', newPass);
    alert("✅ Đổi mật khẩu thành công!");
}

function updateAuthUI() {
    const btn = document.getElementById('authBtn');
    const status = document.getElementById('userStatus');
    
    if (isLoggedIn) {
        btn.innerText = "👋 Chào Admin (Thoát)";
        btn.classList.add('logged-in');
        
        status.innerHTML = `
            <span style="color:var(--success)">👑 Admin (IP: ${userIP})</span>
            <button onclick="changePassword()" style="margin-left:10px; padding:2px 8px; font-size:11px; cursor:pointer;">🔑 Đổi Pass</button>
        `;
    } else {
        btn.innerText = "👤 Đăng nhập";
        btn.classList.remove('logged-in');
        // [CẬP NHẬT] Hiển thị IP khách
        status.innerHTML = `
            Khách (IP: <b>${userIP}</b>) <br> 
            <span style="font-size: 0.9em; opacity: 0.8">Giới hạn: 1 tệp & ${MAX_GUEST_PLAYS} lượt chơi.</span>
        `;
        status.style.color = "var(--text-sub)";
    }
}

// KHỞI CHẠY KHI LOAD TRANG
initTheme();
initLoginState();
detectUserIP(); // Gọi hàm lấy IP


// --- PHẦN 1: XỬ LÝ NẠP DỮ LIỆU ---
function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let content = cleanInputString(e.target.result);
            addBatch(content, file.name);
            fileInput.value = ""; 
        };
        reader.readAsText(file);
    }
}

function loadFromText() {
    let content = document.getElementById('jsonInput').value.trim();
    if(!content) return alert("Vui lòng dán dữ liệu vào ô trống!");
    content = cleanInputString(content);
    addBatch(content, "Text Import #" + (questionBatches.length + 1));
    document.getElementById('jsonInput').value = "";
}

function cleanInputString(str) {
    str = str.replace(/(const|var|let)\s+\w+\s*=\s*/g, ""); 
    str = str.replace(/;\s*$/, "");
    return str;
}

function addBatch(jsonString, sourceName) {
    // --- CHECK GIỚI HẠN KHÁCH ---
    if (!isLoggedIn) {
        if (hasGuestUploaded) {
            alert(`⛔ CHẶN (IP: ${userIP})!\n\nBạn đã sử dụng quyền nạp 1 file.\nVui lòng ĐĂNG NHẬP để nạp thêm.`);
            toggleLoginModal();
            return; 
        }

        if (questionBatches.length >= MAX_GUEST_FILES) {
            alert(`⚠️ GIỚI HẠN KHÁCH!\n\nChỉ được phép giữ 1 file.`);
            return;
        }
        guestPlayCount = 0;
    }

    try {
        let newData = [];
        try { newData = JSON.parse(jsonString); } 
        catch { newData = eval('(' + jsonString + ')'); }

        if(Array.isArray(newData) && newData.length > 0) {
            questionBatches.push({
                id: Date.now(),
                name: sourceName,
                data: newData
            });
            
            // Đánh dấu khách đã nạp file và lưu vào localStorage để chặn khi F5
            if (!isLoggedIn) {
                hasGuestUploaded = true;
                localStorage.setItem('guest_uploaded_status', 'true');
            }

            rebuildTotalQuestions();
            renderBatchList();
            
            if(!isLoggedIn) {
                alert(`Đã thêm tệp thành công!\nIP ${userIP} có ${MAX_GUEST_PLAYS} lượt làm bài.`);
            }

        } else {
            alert("Lỗi: Dữ liệu không đúng định dạng mảng câu hỏi.");
        }
    } catch (e) {
        alert("Lỗi phân tích dữ liệu: " + e.message);
    }
}

function removeBatch(batchId) {
    if(!confirm("Bạn muốn xóa tệp này?")) return;
    questionBatches = questionBatches.filter(b => b.id !== batchId);
    rebuildTotalQuestions();
    renderBatchList();
}

function rebuildTotalQuestions() {
    questions = [];
    questionBatches.forEach(batch => {
        questions = questions.concat(batch.data);
    });
    document.getElementById('totalBadge').innerText = `${questions.length} câu`;
    
    const gameModeDiv = document.getElementById('gameMode');
    if(questions.length > 0) gameModeDiv.classList.remove('hidden');
    else gameModeDiv.classList.add('hidden');
}

function renderBatchList() {
    let listDiv = document.getElementById('importHistory');
    listDiv.innerHTML = ""; 
    questionBatches.forEach(batch => {
        let item = document.createElement('div');
        item.className = 'import-log';
        item.innerHTML = `
            <div>
                <span style="font-weight:500">📄 ${batch.name}</span>
                <span style="font-size:12px; opacity:0.7; margin-left:5px">(${batch.data.length} câu)</span>
            </div>
            <button class="btn-delete-item" onclick="removeBatch(${batch.id})" title="Xóa file này">✕</button>
        `;
        listDiv.appendChild(item);
    });
}

// --- PHẦN 2: LOGIC GAME ---
const shuffle=a=>a.sort(()=>Math.random()-0.5);

function startCountdown(seconds){
 clearInterval(countdown);
 timeLeft=seconds;
 countdown=setInterval(()=>{
  let m=String(Math.floor(timeLeft/60)).padStart(2,'0');
  let s=String(timeLeft%60).padStart(2,'0');
  timer.innerText=`⏳ ${m}:${s}`;
  timeLeft--;
  if(timeLeft<0){
   clearInterval(countdown);
   showResult(true);
  }
 },1000);
}

// --- CHECK LƯỢT CHƠI ---
function startQuiz(n, minutes=null){
 let d = document.getElementById('customDelay').value;
 delayTime = (d && d > 0) ? parseInt(d) : 800;

 if(questions.length === 0) return alert("Kho câu hỏi trống!");

 if (!isLoggedIn) {
      if (guestPlayCount >= MAX_GUEST_PLAYS) {
        alert(`⚠️ IP: ${userIP} ĐÃ HẾT LƯỢT!\n\nBạn đã dùng hết ${MAX_GUEST_PLAYS} lượt làm bài.\nVui lòng Đăng nhập.`);
        toggleLoginModal();
        return;
      }
      guestPlayCount++;
 }

 if(n === 'all' || n > questions.length) n = questions.length;

 resetUI();
 if(savedQuestionCount===null){
  savedQuestionCount=n;
  savedTimeMinutes=minutes;
 }

 let available = questions
  .map((q,idx)=>({q,idx}))
  .filter(x=>!usedIndexes.has(x.idx));

 if(available.length === 0) {
    showOutOfQuestionsScreen();
    return;
 }
 
 if(available.length < n){
    alert(`Chỉ còn ${available.length} câu hỏi mới. Sẽ bắt đầu với số lượng này.`);
    n = available.length;
 }

 let picked=shuffle(available).slice(0,n);
 quizQuestions=picked.map(item=>{
  usedIndexes.add(item.idx);
  let ops=item.q.options.map((t,i)=>({text:t,old:i}));
  shuffle(ops);
  return {
   q: item.q.q,
   options: ops,
   originalAnswer: item.q.answer,
   correctIndex: ops.findIndex(o=>o.old===item.q.answer)
  };
 });

 initQuizSession(minutes);
}

function startCustom(){
 let n=parseInt(document.getElementById('customNum').value);
 let t=parseInt(document.getElementById('customTime').value);
 if(!n||n<1) return alert("Số câu phải > 0");
 if(n>questions.length) return alert("Hiện tại chỉ có " + questions.length + " câu.");
 startQuiz(n,t);
}

// --- CHECK LƯỢT CHƠI KHI RETRY ---
function retryCurrentQuiz() {
    if (!isLoggedIn) {
        if (guestPlayCount >= MAX_GUEST_PLAYS) {
            alert(`⚠️ IP: ${userIP} ĐÃ HẾT LƯỢT!\n\nVui lòng Đăng nhập.`);
            toggleLoginModal();
            return;
        }
        guestPlayCount++;
    }

    shuffle(quizQuestions);
    quizQuestions.forEach(q => {
        shuffle(q.options);
        q.correctIndex = q.options.findIndex(o => o.old === q.originalAnswer);
    });
    resetUI();
    initQuizSession(savedTimeMinutes);
}

function restartAllQuestions() {
    usedIndexes.clear();
    startQuiz(savedQuestionCount, savedTimeMinutes);
}

function showOutOfQuestionsScreen() {
    resetUI();
    document.getElementById("statusBar").classList.add("hidden");
    
    let remaining = MAX_GUEST_PLAYS - guestPlayCount;
    let retryText = isLoggedIn ? "↺ Làm lại bộ vừa thi" : `↺ Làm lại (Còn ${remaining < 0 ? 0 : remaining} lượt)`;
    
    let html = `
        <div class="result-summary" style="border-color:var(--warning)">
            <h3>⚠️ ĐÃ HẾT CÂU HỎI MỚI!</h3>
            <p>Bạn đã hoàn thành tất cả câu hỏi trong kho.</p>
            
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px; max-width:300px; margin-left:auto; margin-right:auto;">
                <button onclick="retryCurrentQuiz()" class="btn-retry">${retryText}</button>
                <button onclick="restartAllQuestions()" class="btn-success">🔁 Reset & Làm lại toàn bộ</button>
                <button onclick="resetAll()" class="btn-reset">🏠 Về màn hình chính</button>
            </div>
        </div>
    `;
    
    document.getElementById("quiz").innerHTML = html;
}

function initQuizSession(minutes) {
    answers=[]; i=0;
    document.getElementById("start").style.display="none";
    document.getElementById("statusBar").classList.remove("hidden");
    document.getElementById("endBtn").style.display="inline-block";
    if(minutes && minutes>0) startCountdown(minutes*60);
    else timer.innerText="⏱ Không giới hạn";
    loadQ(0);
}

function loadQ(n){
 let q=quizQuestions[n];
 progress.innerText=`Câu ${n+1} / ${quizQuestions.length}`;
 let h=`<h3>${q.q}</h3><div class="option-container">`;
 q.options.forEach((o,idx)=>{
  h+=`<div id="opt-${idx}" class="option-card" onclick="check(${idx})">${o.text}</div>`;
 });
 h+=`</div>`;
 quiz.innerHTML=h;
}

function check(c){
 answers[i]=c;
 let q=quizQuestions[i];
 let selectedDiv = document.getElementById(`opt-${c}`);
 let correctDiv = document.getElementById(`opt-${q.correctIndex}`);
 document.querySelectorAll('.option-card').forEach(el => el.classList.add('disabled-click'));

 if(c === q.correctIndex) selectedDiv.classList.add('correct');
 else {
    selectedDiv.classList.add('wrong');
    correctDiv.classList.add('correct');
 }
 
 nextQuestionTimeout = setTimeout(()=>{ 
    i++; 
    i<quizQuestions.length ? loadQ(i) : showResult(false); 
 }, delayTime);
}

function endNow(){
 if(confirm("Kết thúc bài ngay?")){ showResult(false); }
}

function showResult(outOfTime){
 clearInterval(countdown);
 clearTimeout(nextQuestionTimeout); 

 document.getElementById("endBtn").style.display="none";
 document.getElementById("statusBar").classList.add("hidden");

 let dung = 0;
 quizQuestions.forEach((q,idx)=>{
  if(answers[idx]===q.correctIndex) dung++;
 });
 let diem = ((dung/quizQuestions.length)*10).toFixed(2);
 let sai = quizQuestions.length - dung;
 
 let viewAction = isLoggedIn ? "viewDetails" : "showLoginRequired";
 let lockIcon = isLoggedIn ? "" : "🔒";
 let subText = isLoggedIn ? "(Xem chi tiết)" : "(Cần đăng nhập)";
 let cursorStyle = isLoggedIn ? "pointer" : "not-allowed";

 let remaining = MAX_GUEST_PLAYS - guestPlayCount;
 let retryText = isLoggedIn ? "↺ Làm lại" : `↺ Làm lại (Còn ${remaining < 0 ? 0 : remaining} lượt)`;

 let h=`
 <div class="result-summary">
    <h3>${outOfTime ? "⏰ HẾT GIỜ!" : "🏁 HOÀN THÀNH"}</h3>
    <h1 style="color:${diem >= 5 ? 'var(--success)' : 'var(--error)'}; font-size: 3em; margin: 10px 0;">${diem}</h1>
    
    <div style="display:flex; justify-content:center; gap:10px; margin-top:15px; flex-wrap:wrap">
        <div class="stat-btn correct-stat" onclick="${viewAction}('correct', this)" style="cursor:${cursorStyle}">
            ${lockIcon} ✔ Đúng: ${dung} câu <br><span style="font-size:11px; font-weight:normal">${subText}</span>
        </div>
        <div class="stat-btn wrong-stat" onclick="${viewAction}('wrong', this)" style="cursor:${cursorStyle}">
            ${lockIcon} ✘ Sai: ${sai} câu <br><span style="font-size:11px; font-weight:normal">${subText}</span>
        </div>
    </div>
 </div>

<div style="text-align:center; margin-bottom:20px; display:flex; flex-wrap:wrap; justify-content:center;">
    <button onclick="continueQuiz()">👉 Tiếp tục thi</button>
    <button onclick="retryCurrentQuiz()" class="btn-retry">${retryText}</button>
    ${sai > 0 ? `<button onclick="retryWrongQuestions()" class="btn-danger">❌ Làm lại câu sai (${sai})</button>` : ""}
    <button onclick="resetAll()" class="btn-reset">🏠 Về màn hình chính</button>
 </div>
 
 <hr>
 <div id="detailArea">
    ${isLoggedIn ? 
        '<p style="text-align:center; opacity:0.7; font-style:italic">Bấm vào mục "Đúng" hoặc "Sai" ở trên để xem chi tiết.</p>' : 
        '<p style="text-align:center; color:var(--warning); font-weight:bold;">🔒 Bạn cần đăng nhập để xem lại đáp án chi tiết.</p>'}
 </div>`;

 quiz.innerHTML="";
 result.innerHTML=h;
}

function showLoginRequired() {
    alert("🔒 TÍNH NĂNG DÀNH CHO ADMIN\n\nVui lòng đăng nhập để xem chi tiết câu đúng/sai.");
    toggleLoginModal();
}

function viewDetails(type, btnElement) {
    if (!isLoggedIn) {
        return showLoginRequired();
    }

    document.querySelectorAll('.stat-btn').forEach(b => {
        b.classList.remove('active-correct', 'active-wrong');
    });
    if(type === 'correct') btnElement.classList.add('active-correct');
    else btnElement.classList.add('active-wrong');

    let html = `<h3>📝 Danh sách câu ${type === 'correct' ? 'ĐÚNG' : 'SAI / BỎ QUA'}:</h3>`;
    let count = 0;

    quizQuestions.forEach((q, idx) => {
        let userChoice = answers[idx];
        let isCorrect = (userChoice === q.correctIndex);

        if (type === 'correct' && !isCorrect) return; 
        if (type === 'wrong' && isCorrect) return;

        count++;
        html += `<div class="review-item"><p><b>Câu ${idx+1}:</b> ${q.q}</p>`;
        
        if (userChoice === undefined) {
            html += `<p style="color:var(--warning)">⏭️ Đã bỏ qua</p>`;
        }

        q.options.forEach((o, optIdx) => {
            let cssClass = "";
            let icon = "";
            
            if (optIdx === q.correctIndex) { 
                cssClass = "correct-mark"; 
                icon = " ✅"; 
            }
            if (userChoice !== undefined && optIdx === userChoice && optIdx !== q.correctIndex) { 
                cssClass = "wrong-mark"; 
                icon = " ❌"; 
            }
            
            html += `<div class="review-option ${cssClass}">${o.text} ${icon}</div>`;
        });
        html += `</div>`;
    });

    if (count === 0) {
        html += `<p style="text-align:center; padding:20px;">Không có câu hỏi nào trong mục này.</p>`;
    }

    document.getElementById('detailArea').innerHTML = html;
    document.getElementById('detailArea').scrollIntoView({behavior: "smooth"});
}

function continueQuiz(){ startQuiz(savedQuestionCount, savedTimeMinutes); }

function resetUI(){
 clearInterval(countdown);
 clearTimeout(nextQuestionTimeout); 
 timer.innerHTML=""; quiz.innerHTML=""; progress.innerHTML=""; result.innerHTML="";
 document.getElementById("statusBar").classList.add("hidden");
 document.getElementById("endBtn").style.display="none";
}

function resetAll(){
 clearInterval(countdown);
 clearTimeout(nextQuestionTimeout); 
 savedQuestionCount=null; savedTimeMinutes=null;
 quizQuestions=[]; answers=[]; i=0;
 usedIndexes.clear(); 
 document.getElementById("result").innerHTML="";
 document.getElementById("quiz").innerHTML="";
 document.getElementById("statusBar").classList.add("hidden");
 document.getElementById("endBtn").style.display="none";
 document.getElementById("start").style.display="block";
}
function retryWrongQuestions() {
    // 1. Kiểm tra giới hạn lượt chơi của khách
    if (!isLoggedIn) {
        if (guestPlayCount >= MAX_GUEST_PLAYS) {
            alert(`⚠️ IP: ${userIP} ĐÃ HẾT LƯỢT!\n\nVui lòng Đăng nhập.`);
            toggleLoginModal();
            return;
        }
        guestPlayCount++;
    }

    // 2. Lọc ra danh sách các câu sai hoặc chưa làm (bỏ qua)
    let wrongQuestions = quizQuestions.filter((q, idx) => answers[idx] !== q.correctIndex);

    if (wrongQuestions.length === 0) {
        return alert("Tuyệt vời! Bạn không có câu sai nào.");
    }

    // 3. Ghi đè lại danh sách câu hỏi hiện tại bằng các câu sai
    quizQuestions = wrongQuestions;

    // 4. Đảo lại vị trí câu hỏi và đáp án để tránh học vẹt
    shuffle(quizQuestions);
    quizQuestions.forEach(q => {
        shuffle(q.options);
        q.correctIndex = q.options.findIndex(o => o.old === q.originalAnswer);
    });

    // 5. Reset UI và bắt đầu lại bài thi với các câu sai
    resetUI();
    initQuizSession(savedTimeMinutes);
}
