// Forretningslogikk for Helvetesuka App

// Standardapplikasjonstilstand
let state = {
    isActive: false,
    startDate: '', // YYYY-MM-DD
    activeDay: 1, // 1 to 7
    completedRules: {}, // YYYY-MM-DD -> Array of rule IDs ['wake', 'sleep', 'exercise', 'food', 'offline', 'efficiency']
    journals: {}, // YYYY-MM-DD -> String journal text
    habits: [
        { id: 1, name: 'Sjekke telefonen med en gang jeg våkner', type: 'bad' },
        { id: 2, name: 'Drikke kaffe på tom mage', type: 'bad' },
        { id: 3, name: 'Gå en times tur med Milo i skogen', type: 'good' }
    ],
    modeLog: {}, // YYYY-MM-DD -> Array of { time: '14:32', mode: 'Fokusert', reflection: '...' }
    activeMode: {}, // YYYY-MM-DD -> String mode
    activeModeReflection: {}, // YYYY-MM-DD -> String reflection
    timeBlocks: {}, // YYYY-MM-DD -> Array of { hour: '05:00', text: '', completed: false }
    comfortActions: [], // Array of { id, text, date }
    checkpoints: {}, // YYYY-MM-DD -> Array of checked checkpoint indices
    brags: [
        { id: 1, text: 'Jeg er ekstremt god til å holde fokus når jeg legger bort telefonen.' },
        { id: 2, text: 'Jeg klarer alltid å fullføre treningsøkter selv når jeg er sliten.' }
    ],
    sundayEval: {
        takeaway: '',
        standard: '',
        reward: ''
    },
    prepCompleted: [],
    prepIntentions: '',
    history: []
};

// Valg av visningsdag (1-7)
let selectedDay = 1;

// Referanser til tidsur
let powernapInterval = null;
let powernapTimeLeft = 1200; // 20 min in seconds
let isPowernapRunning = false;
let isTestNap = false;

// Referanser til pusteboble
let breathingInterval = null;
let breathingPhase = 0; // 0: inhale, 1: hold, 2: exhale, 3: hold
let isBreathingActive = false;

// Referanser til all-nighter
let awakeTimerInterval = null;

// Lyd-synthesizer (Web Audio API)
let audioCtx = null;
function playTone(freq, type, duration) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = type || 'sine';
        osc.frequency.value = freq || 440;
        
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        // Fade ut mot slutten
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Lydavspilling feilet: ", e);
    }
}

function playSuccessBeep() {
    playTone(523.25, 'triangle', 0.15); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.2), 100); // E5
}

function playTimerCompleteBeep() {
    playTone(587.33, 'sine', 0.2); // D5
    setTimeout(() => playTone(587.33, 'sine', 0.2), 250);
    setTimeout(() => playTone(880, 'sine', 0.4), 500); // A5
}

// -------------------------------------------------------------
// Initialize App
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    setupOnboardingDefaults();
    updateHistoryBadge();
    updateNotificationIcon();
    startNotificationScheduler();
    
    if (state.isActive) {
        // Beregn og sett dag automatisk ved oppstart basert på dagens dato
        calculateCurrentRealDay();
        selectedDay = state.activeDay;
        
        showScreen("app-screen");
        renderApp();
        startAwakeTimer();
    } else {
        showScreen("onboarding-screen");
    }
});

// Sett standard onboarding dato til førstkommende mandag
function setupOnboardingDefaults() {
    const dateInput = document.getElementById("start-date-input");
    if (dateInput) {
        const today = new Date();
        const resultDate = new Date(today);
        // Førstkommende mandag
        const dayOfWeek = today.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        resultDate.setDate(today.getDate() + daysUntilMonday);
        
        const yyyy = resultDate.getFullYear();
        const mm = String(resultDate.getMonth() + 1).padStart(2, '0');
        const dd = String(resultDate.getDate()).padStart(2, '0');
        
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

// Hent stat fra LocalStorage
function loadState() {
    const saved = localStorage.getItem("helvetesuka-state");
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.prepCompleted) state.prepCompleted = [];
            if (!state.prepIntentions) state.prepIntentions = "";
            if (!state.history) state.history = [];
        } catch (e) {
            console.error("Feil ved parsing av lagret data:", e);
        }
    }
}

// Lagre stat til LocalStorage
function saveState() {
    localStorage.setItem("helvetesuka-state", JSON.stringify(state));
}

// Skift skjerm med fin fade-inn
function showScreen(screenId) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach(s => {
        s.classList.remove("active");
        s.style.display = "none";
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = screenId === "app-screen" ? "flex" : "flex";
        setTimeout(() => target.classList.add("active"), 50);
    }
}

// -------------------------------------------------------------
// Onboarding og oppsett
// -------------------------------------------------------------
function startHelvetesuka() {
    const dateVal = document.getElementById("start-date-input").value;
    if (!dateVal) return;
    
    state.isActive = true;
    state.startDate = dateVal;
    state.completedRules = {};
    state.journals = {};
    state.modeLog = {};
    state.activeMode = {};
    state.activeModeReflection = {};
    state.timeBlocks = {};
    state.checkpoints = {};
    state.comfortActions = [];
    state.sundayEval = { takeaway: '', standard: '', reward: '' };
    state.prepCompleted = [];
    state.prepIntentions = '';
    
    // Beregn aktiv dag
    calculateCurrentRealDay();
    selectedDay = state.activeDay;
    
    saveState();
    playSuccessBeep();
    showScreen("app-screen");
    renderApp();
    startAwakeTimer();
}

// Beregn hvilken dag vi er på basert på startdato
function calculateCurrentRealDay() {
    if (!state.startDate) return;
    
    const start = new Date(state.startDate);
    start.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 1-indexert
    
    if (diffDays < 1) {
        state.activeDay = 0; // Forberedelsesdag (Dag 0)
    } else if (diffDays > 7) {
        state.activeDay = 7; // Etter fullføring
    } else {
        state.activeDay = diffDays;
    }
}

// Formatere dato til lesbar norsk tekst
function getFormattedDateString(dayIndex) {
    if (!state.startDate) return '';
    const start = new Date(state.startDate);
    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + (dayIndex - 1));
    
    const dager = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
    const maaneder = [
        "Januar", "Februar", "Mars", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Desember"
    ];
    
    const dagNavn = dager[targetDate.getDay()];
    const dagNum = targetDate.getDate();
    const maanedNavn = maaneder[targetDate.getMonth()];
    
    // Finn ukenummer
    const firstDayOfYear = new Date(targetDate.getFullYear(), 0, 1);
    const pastDaysOfYear = (targetDate - firstDayOfYear) / 86400000;
    const ukeNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    return `Uke ${ukeNum}, ${dagNavn} ${dagNum}. ${maanedNavn}`;
}

// -------------------------------------------------------------
// Renders og Navigasjon
// -------------------------------------------------------------
function renderApp() {
    renderTimeline();
    renderDayHeader();
    renderDailyChecklist();
    renderJournal();
    renderActiveModule();
    updateTimelineStatusIcons();
}

// Tegn daglinjen (Mandag-Søndag navigasjon)
function renderTimeline() {
    const buttons = document.querySelectorAll(".nav-day-btn");
    buttons.forEach((btn) => {
        const day = parseInt(btn.getAttribute("data-day"));
        
        btn.classList.remove("active");
        if (day === selectedDay) {
            btn.classList.add("active");
        }
        
        // Marker dagen i knappen (F.eks "I dag")
        const numLabel = btn.querySelector(".day-num");
        if (day === state.activeDay) {
            numLabel.innerText = "I DAG";
            numLabel.style.color = "var(--neon-accent)";
            numLabel.style.fontWeight = "700";
        } else {
            numLabel.innerText = day === 0 ? "Prep" : `Dag ${day}`;
            numLabel.style.color = "var(--text-muted)";
            numLabel.style.fontWeight = "normal";
        }
    });
}

function updateTimelineStatusIcons() {
    const buttons = document.querySelectorAll(".nav-day-btn");
    buttons.forEach((btn) => {
        const day = parseInt(btn.getAttribute("data-day"));
        
        // Beregn fullføringsgrad for den spesifikke dagen
        const progress = calculateDayProgress(day);
        
        btn.classList.remove("completed");
        if (progress >= 100) {
            btn.classList.add("completed");
        }
    });
}

function renderDayHeader() {
    if (selectedDay === 0) {
        document.getElementById("current-day-name").innerText = "Forberedelse";
        document.getElementById("current-day-theme").innerText = "Gjør deg klar";
        document.getElementById("current-date-display").innerText = getFormattedDateString(0);
        
        // Oppdater progresjonsring og prosentsats
        const progress = calculateDayProgress(0);
        const progressPercentText = document.getElementById("day-progress-percent");
        progressPercentText.innerText = `${progress}%`;
        
        const circle = document.getElementById("day-progress-circle");
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (progress / 100) * circumference;
        circle.style.strokeDashoffset = offset;
        
        const totalCompleted = (state.prepCompleted || []).length;
        document.getElementById("completed-count-label").innerText = `${totalCompleted} av 5 oppgaver fullført`;
        return;
    }

    const dager = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
    const temaer = [
        "Vaner",
        "Modus & Fokus",
        "Tidsstyring",
        "Ut av komfortsonen",
        "Hvile & Restitusjon",
        "Indre dialog",
        "Sette livet i perspektiv"
    ];
    
    document.getElementById("current-day-name").innerText = dager[selectedDay - 1];
    document.getElementById("current-day-theme").innerText = temaer[selectedDay - 1];
    document.getElementById("current-date-display").innerText = getFormattedDateString(selectedDay);
    
    // Oppdater progresjonsring og prosentsats
    const progress = calculateDayProgress(selectedDay);
    const progressPercentText = document.getElementById("day-progress-percent");
    progressPercentText.innerText = `${progress}%`;
    
    const circle = document.getElementById("day-progress-circle");
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (progress / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Oppdater fullført-teller
    const dateKey = getFormattedDateKey(selectedDay);
    const checkedCount = (state.completedRules[dateKey] || []).length;
    const taskPoint = isDayTaskCompleted(selectedDay) ? 1 : 0;
    const totalCount = checkedCount + taskPoint;
    
    document.getElementById("completed-count-label").innerText = `${totalCount} av 7 oppgaver fullført`;
}

// Returner nøkkel YYYY-MM-DD for en gitt ukedag (1-7)
function getFormattedDateKey(dayIndex) {
    if (!state.startDate) return '';
    const start = new Date(state.startDate);
    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + (dayIndex - 1));
    return targetDate.toISOString().split("T")[0];
}

// Beregn progresjonsprosent for en gitt dag
function calculateDayProgress(dayIndex) {
    if (dayIndex === 0) {
        const completed = state.prepCompleted || [];
        return Math.min(100, Math.round((completed.length / 5) * 100));
    }
    const dateKey = getFormattedDateKey(dayIndex);
    const checkedRules = state.completedRules[dateKey] || [];
    
    // 6 regler + 1 dag-spesifikk oppgave (teller som 16.6% hver)
    const ruleCount = checkedRules.length; // max 6
    const hasThemeTask = isDayTaskCompleted(dayIndex);
    
    const score = ruleCount + (hasThemeTask ? 1 : 0);
    return Math.min(100, Math.round((score / 7) * 100));
}

// Sjekker om dagens spesifikke tema-oppgave er utført
function isDayTaskCompleted(dayIndex) {
    if (dayIndex === 0) {
        return (state.prepCompleted || []).length >= 5;
    }
    const dateKey = getFormattedDateKey(dayIndex);
    switch (dayIndex) {
        case 1: // Mandag: Minst én vane registrert
            return state.habits.length > 0;
        case 2: // Tirsdag: Modus valgt
            return !!state.activeMode[dateKey];
        case 3: // Onsdag: Minst 3 tidsblokker krysset av
            const blocks = state.timeBlocks[dateKey] || [];
            return blocks.filter(b => b.completed).length >= 3;
        case 4: // Torsdag: Minst 1 natt-sjekkpunkt eller 1 komfort-handling registrert
            const checkedCPs = state.checkpoints[dateKey] || [];
            const hasComfortAction = state.comfortActions.length > 0;
            return checkedCPs.length > 0 || hasComfortAction;
        case 5: // Fredag: Powernap fullført
            return !isPowernapRunning && powernapTimeLeft === 0;
        case 6: // Lørdag: Minst 1 brag wall card lagt til
            return state.brags.length > 0;
        case 7: // Søndag: Evaluering fylt ut
            return !!state.sundayEval.takeaway && !!state.sundayEval.standard && !!state.sundayEval.reward;
        default:
            return false;
    }
}

// -------------------------------------------------------------
// Sjekkliste: Faste Regler
// -------------------------------------------------------------
function renderDailyChecklist() {
    const checklistContainer = document.querySelector(".checklist-container");
    if (!checklistContainer) return;
    
    let placeholder = document.getElementById("rules-prep-placeholder");
    
    if (selectedDay === 0) {
        checklistContainer.style.display = "none";
        if (!placeholder) {
            placeholder = document.createElement("div");
            placeholder.id = "rules-prep-placeholder";
            placeholder.className = "motivation-quote-box";
            placeholder.style.marginTop = "0";
            placeholder.innerHTML = `<i class="fa-solid fa-hourglass-start"></i> <span>Reglene starter ikke før Mandag kl. 05:00. Bruk denne dagen til planlegging, mental forberedelse og hvile!</span>`;
            checklistContainer.after(placeholder);
        }
        placeholder.style.display = "flex";
        return;
    }
    
    checklistContainer.style.display = "flex";
    if (placeholder) {
        placeholder.style.display = "none";
    }

    const dateKey = getFormattedDateKey(selectedDay);
    const checked = state.completedRules[dateKey] || [];
    
    const rules = ['wake', 'sleep', 'exercise', 'food', 'offline', 'efficiency'];
    
    rules.forEach(rule => {
        const checkbox = document.getElementById(`rule-${rule}`);
        const container = document.getElementById(`rule-item-${rule}`);
        if (checkbox) {
            const isChecked = checked.includes(rule);
            checkbox.checked = isChecked;
            
            if (container) {
                if (isChecked) {
                    container.classList.add("checked");
                } else {
                    container.classList.remove("checked");
                }
            }
        }
    });
    
    // Torsdag har spesiell regel (skal ikke sove kl. 22:00)
    const sleepRuleText = document.querySelector("#rule-item-sleep .item-text");
    if (selectedDay === 4) {
        if (sleepRuleText) sleepRuleText.innerHTML = "Holde seg våken og **døgne** gjennom natten";
    } else {
        if (sleepRuleText) sleepRuleText.innerHTML = "Legge seg presis klokken <strong>22:00</strong>";
    }
}

function toggleRule(ruleId) {
    const dateKey = getFormattedDateKey(selectedDay);
    if (!state.completedRules[dateKey]) {
        state.completedRules[dateKey] = [];
    }
    
    const index = state.completedRules[dateKey].indexOf(ruleId);
    if (index > -1) {
        state.completedRules[dateKey].splice(index, 1);
    } else {
        state.completedRules[dateKey].push(ruleId);
        playTone(700, 'sine', 0.08); // Liten klikkelyd
    }
    
    saveState();
    renderDayHeader();
    renderDailyChecklist();
    updateTimelineStatusIcons();
}

// -------------------------------------------------------------
// Journal / Dagbok
// -------------------------------------------------------------
function renderJournal() {
    const dateKey = getFormattedDateKey(selectedDay);
    const textarea = document.getElementById("daily-journal");
    if (textarea) {
        textarea.value = state.journals[dateKey] || '';
    }
}

function saveJournal() {
    const dateKey = getFormattedDateKey(selectedDay);
    const text = document.getElementById("daily-journal").value;
    state.journals[dateKey] = text;
    saveState();
    
    // Vis lagret-indikator
    const indicator = document.querySelector(".input-saved-indicator");
    if (indicator) {
        indicator.style.opacity = "1";
        setTimeout(() => {
            indicator.style.opacity = "0.5";
        }, 1000);
    }
}

// -------------------------------------------------------------
// Skifting av Aktiv Dag-modul
// -------------------------------------------------------------
function setActiveDay(dayNum) {
    selectedDay = dayNum;
    
    // Stopp eventuell timer eller veiledning fra forrige dag
    stopBreathingGuide();
    
    renderApp();
}

function renderActiveModule() {
    // Skjul alle moduler
    const modules = document.querySelectorAll(".theme-module");
    modules.forEach(m => m.classList.remove("active"));
    
    // Vis valgt modul
    const target = document.getElementById(`module-day-${selectedDay}`);
    if (target) {
        target.classList.add("active");
        
        // Initialiser dag-spesifikke elementer
        switch (selectedDay) {
            case 0:
                renderPrepDay();
                break;
            case 1:
                renderHabits();
                break;
            case 2:
                renderModesModule();
                break;
            case 3:
                initAndRenderTimeblocks();
                break;
            case 4:
                renderComfortActions();
                updateCheckpointVisuals();
                break;
            case 5:
                updatePowernapDisplay();
                break;
            case 6:
                renderBrags();
                break;
            case 7:
                renderSundayModule();
                break;
        }
    }
}

// -------------------------------------------------------------
// Mandag: Vaner (Day 1)
// -------------------------------------------------------------
function renderHabits() {
    const list = document.getElementById("habits-list");
    if (!list) return;
    
    list.innerHTML = "";
    state.habits.forEach(h => {
        const li = document.createElement("li");
        
        const badge = document.createElement("span");
        badge.className = `habit-badge ${h.type}`;
        badge.innerText = h.type === 'good' ? 'Vane (+)' : 'Uvane (-)';
        
        const textSpan = document.createElement("span");
        textSpan.innerText = ` ${h.name}`;
        
        const contentDiv = document.createElement("div");
        contentDiv.className = "li-content-row";
        contentDiv.appendChild(badge);
        contentDiv.appendChild(textSpan);
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-card-btn";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.onclick = () => deleteHabit(h.id);
        
        li.appendChild(contentDiv);
        li.appendChild(deleteBtn);
        list.appendChild(li);
    });
}

function addNewHabit() {
    const input = document.getElementById("habit-name");
    const select = document.getElementById("habit-type");
    if (!input || !input.value) return;
    
    const newId = Date.now();
    state.habits.push({
        id: newId,
        name: input.value,
        type: select.value
    });
    
    input.value = "";
    saveState();
    renderHabits();
    renderDayHeader();
    updateTimelineStatusIcons();
    playSuccessBeep();
}

function deleteHabit(id) {
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    renderHabits();
    renderDayHeader();
    updateTimelineStatusIcons();
}

// -------------------------------------------------------------
// Tirsdag: Modus & Fokus (Day 2)
// -------------------------------------------------------------
function renderModesModule() {
    const dateKey = getFormattedDateKey(2); // Sparer til Tirsdag
    const activeMode = state.activeMode[dateKey] || '';
    const reflection = state.activeModeReflection[dateKey] || '';
    
    // Marker aktiv modusknapp
    const buttons = document.querySelectorAll(".mode-btn");
    buttons.forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute("data-mode") === activeMode) {
            btn.classList.add("active");
        }
    });
    
    // Vis/skjul refleksjonspanel
    const refCard = document.getElementById("active-mode-display");
    if (activeMode) {
        refCard.classList.add("active");
        document.getElementById("current-mode-name").innerText = activeMode;
        document.getElementById("mode-reflection-input").value = reflection;
    } else {
        refCard.classList.remove("active");
    }
    
    // Render logg
    const logList = document.getElementById("mode-log-list");
    if (logList) {
        logList.innerHTML = "";
        const logs = state.modeLog[dateKey] || [];
        
        if (logs.length === 0) {
            logList.innerHTML = '<li class="text-muted" style="border:none; background:transparent; padding:0;">Ingen moduser logget i dag ennå.</li>';
        } else {
            logs.slice().reverse().forEach(item => {
                const li = document.createElement("li");
                li.innerHTML = `
                    <div>
                        <strong class="text-accent">${item.time}</strong> - 
                        <strong>${item.mode}</strong>
                        <div class="text-secondary" style="font-size:0.85rem; margin-top:2px;">${item.reflection || 'Ingen kommentar'}</div>
                    </div>
                `;
                logList.appendChild(li);
            });
        }
    }
}

function setMentalMode(modeName, iconClass) {
    const dateKey = getFormattedDateKey(2);
    state.activeMode[dateKey] = modeName;
    
    saveState();
    renderModesModule();
    renderDayHeader();
    updateTimelineStatusIcons();
    playSuccessBeep();
}

function saveModeReflection() {
    const dateKey = getFormattedDateKey(2);
    const val = document.getElementById("mode-reflection-input").value;
    state.activeModeReflection[dateKey] = val;
    
    // Legg til i logg
    if (!state.modeLog[dateKey]) {
        state.modeLog[dateKey] = [];
    }
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    state.modeLog[dateKey].push({
        time: timeStr,
        mode: state.activeMode[dateKey],
        reflection: val
    });
    
    saveState();
    renderModesModule();
    playSuccessBeep();
}

// -------------------------------------------------------------
// Onsdag: Time Management (Day 3)
// -------------------------------------------------------------
function initAndRenderTimeblocks() {
    const dateKey = getFormattedDateKey(3); // Onsdag
    
    // Initialiser standard Wednesday time blocks om tomme
    if (!state.timeBlocks[dateKey] || state.timeBlocks[dateKey].length === 0) {
        const defaultBlocks = [];
        const initialTasks = {
            "05:00": "Stå opp presis og reflektere",
            "06:00": "Hard treningsøkt (1 time)",
            "07:00": "Dusj, frokost og tur med Milo",
            "08:00": "Arbeidsdag starter - epost og planlegging",
            "09:00": "Høyfokus arbeid (Møter/Salg)",
            "10:00": "Høyfokus arbeid",
            "11:00": "Høyfokus arbeid",
            "12:00": "Lunsj (Sunt måltid og frisk luft)",
            "13:00": "Oppfølging og admin",
            "14:00": "Høyfokus arbeid",
            "15:00": "Praktiske oppgaver / pause",
            "16:00": "Avslutte jobb, oppsummering",
            "17:00": "Hagearbeid / Vedstabling",
            "18:00": "Middag med Henriette (Sunn mat)",
            "19:00": "Aktiv hvile - gåtur i skogen",
            "20:00": "Journalføring og boklesing",
            "21:00": "Forberede morgendagen, kveldsmat",
            "22:00": "Slukke lyset presis og sove"
        };
        
        for (let hour = 5; hour <= 22; hour++) {
            const hStr = `${String(hour).padStart(2, '0')}:00`;
            defaultBlocks.push({
                hour: hStr,
                text: initialTasks[hStr] || "",
                completed: false
            });
        }
        state.timeBlocks[dateKey] = defaultBlocks;
        saveState();
    }
    
    renderTimeblocks();
}

function renderTimeblocks() {
    const dateKey = getFormattedDateKey(3);
    const container = document.getElementById("time-blocks-list");
    if (!container) return;
    
    container.innerHTML = "";
    const blocks = state.timeBlocks[dateKey] || [];
    
    blocks.forEach((b, idx) => {
        const row = document.createElement("div");
        row.className = `time-row ${b.completed ? 'completed' : ''}`;
        
        row.innerHTML = `
            <div class="time-label">${b.hour}</div>
            <div class="time-input-container">
                <input type="text" value="${b.text}" placeholder="Skriv aktivitet..." onchange="updateTimeblockText(${idx}, this.value)">
            </div>
            <div style="display:flex; justify-content:center;">
                <input type="checkbox" class="time-checkbox" ${b.completed ? 'checked' : ''} onchange="toggleTimeblock(${idx})">
            </div>
        `;
        container.appendChild(row);
    });
}

function updateTimeblockText(index, text) {
    const dateKey = getFormattedDateKey(3);
    state.timeBlocks[dateKey][index].text = text;
    saveState();
}

function toggleTimeblock(index) {
    const dateKey = getFormattedDateKey(3);
    const val = state.timeBlocks[dateKey][index].completed;
    state.timeBlocks[dateKey][index].completed = !val;
    
    if (!val) {
        playTone(600, 'sine', 0.1);
    }
    
    saveState();
    renderTimeblocks();
    renderDayHeader();
    updateTimelineStatusIcons();
}

// -------------------------------------------------------------
// Torsdag: Ut av komfortsonen / Døgning (Day 4)
// -------------------------------------------------------------
function startAwakeTimer() {
    if (awakeTimerInterval) clearInterval(awakeTimerInterval);
    
    awakeTimerInterval = setInterval(updateAwakeTimer, 1000);
}

function updateAwakeTimer() {
    const display = document.getElementById("awake-timer-display");
    if (!display || !state.startDate) return;
    
    // Torsdag er Dag 4. Torsdag kl 05:00 er startdato + 3 dager.
    const start = new Date(state.startDate);
    const thursdayStart = new Date(start);
    thursdayStart.setDate(start.getDate() + 3);
    thursdayStart.setHours(5, 0, 0, 0);
    
    const now = new Date();
    const diff = now - thursdayStart;
    
    if (diff < 0) {
        display.innerText = "Torsdag 05:00";
        display.style.fontSize = "1.8rem";
        display.style.color = "var(--text-muted)";
    } else {
        display.style.fontSize = "2.5rem";
        display.style.color = "var(--neon-danger)";
        
        // Beregn timer:minutter:sekunder
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        display.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

function addComfortAction() {
    const input = document.getElementById("comfort-action-input");
    if (!input || !input.value) return;
    
    state.comfortActions.push({
        id: Date.now(),
        text: input.value,
        date: getFormattedDateKey(4)
    });
    
    input.value = "";
    saveState();
    renderComfortActions();
    renderDayHeader();
    updateTimelineStatusIcons();
    playSuccessBeep();
}

function renderComfortActions() {
    const list = document.getElementById("comfort-actions-list");
    if (!list) return;
    
    list.innerHTML = "";
    if (state.comfortActions.length === 0) {
        list.innerHTML = '<li class="text-muted" style="border:none; background:transparent; padding:0;">Ingen handlinger registrert.</li>';
    } else {
        state.comfortActions.forEach(a => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span><i class="fa-solid fa-bolt text-accent-danger" style="margin-right:8px;"></i>${a.text}</span>
                <button class="delete-card-btn" onclick="deleteComfortAction(${a.id})"><i class="fa-solid fa-trash"></i></button>
            `;
            list.appendChild(li);
        });
    }
}

function deleteComfortAction(id) {
    state.comfortActions = state.comfortActions.filter(a => a.id !== id);
    saveState();
    renderComfortActions();
    renderDayHeader();
    updateTimelineStatusIcons();
}

function confirmCheckpoint(num) {
    const dateKey = getFormattedDateKey(4);
    if (!state.checkpoints[dateKey]) {
        state.checkpoints[dateKey] = [];
    }
    
    if (!state.checkpoints[dateKey].includes(num)) {
        state.checkpoints[dateKey].push(num);
        
        // Spill lyd og oppdater motivasjon
        playSuccessBeep();
        
        const quotes = [
            "«Lykken er å føle på mestring etter å ha strevd!»",
            "«Det er midt på natten. Du gjør det de fleste aldri tør!»",
            "«Søvnløshet i natt gir en enorm mestringsfølelse i morgen.»",
            "«05:00 - Gratulerer, du har overlevd natten! En ny dag er i gang.»"
        ];
        document.getElementById("checkpoint-motivation-text").innerText = quotes[num - 1] || quotes[0];
        
        saveState();
        updateCheckpointVisuals();
        renderDayHeader();
        updateTimelineStatusIcons();
    }
}

function updateCheckpointVisuals() {
    const dateKey = getFormattedDateKey(4);
    const checked = state.checkpoints[dateKey] || [];
    
    for (let i = 1; i <= 4; i++) {
        const card = document.getElementById(`checkpoint-card-${i}`);
        if (card) {
            if (checked.includes(i)) {
                card.classList.add("completed");
            } else {
                card.classList.remove("completed");
            }
        }
    }
}

// -------------------------------------------------------------
// Fredag: Hvile & Restitusjon (Day 5)
// -------------------------------------------------------------
function updatePowernapDisplay() {
    const display = document.getElementById("powernap-display");
    if (!display) return;
    
    const m = Math.floor(powernapTimeLeft / 60);
    const s = powernapTimeLeft % 60;
    display.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function togglePowernap() {
    const btn = document.getElementById("powernap-start-btn");
    
    if (isPowernapRunning) {
        // Pause
        clearInterval(powernapInterval);
        isPowernapRunning = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    } else {
        // Start
        isPowernapRunning = true;
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        
        powernapInterval = setInterval(() => {
            if (powernapTimeLeft > 0) {
                powernapTimeLeft--;
                updatePowernapDisplay();
            } else {
                clearInterval(powernapInterval);
                isPowernapRunning = false;
                btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Start';
                
                // Spill av alarm-lyd
                playTimerCompleteBeep();
                
                alert("Powernap fullført! Føler du deg uthvilt?");
                
                powernapTimeLeft = 1200; // Reset
                updatePowernapDisplay();
                
                saveState();
                renderDayHeader();
                updateTimelineStatusIcons();
            }
        }, 1000);
        
        playTone(440, 'sine', 0.1);
    }
}

function triggerTestNap() {
    // Kjører en 10-sekunders test-nap
    clearInterval(powernapInterval);
    powernapTimeLeft = 10;
    updatePowernapDisplay();
    
    isPowernapRunning = false;
    togglePowernap();
}

function toggleBreathingGuide() {
    const btn = document.getElementById("breathing-toggle-btn");
    const bubble = document.getElementById("breathing-bubble-el");
    const text = document.getElementById("breathing-text-el");
    
    if (isBreathingActive) {
        stopBreathingGuide();
    } else {
        isBreathingActive = true;
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stopp';
        btn.classList.add("btn-danger");
        
        breathingPhase = 0;
        runBreathingCycle(bubble, text);
        breathingInterval = setInterval(() => runBreathingCycle(bubble, text), 4000);
    }
}

function stopBreathingGuide() {
    const btn = document.getElementById("breathing-toggle-btn");
    const bubble = document.getElementById("breathing-bubble-el");
    const text = document.getElementById("breathing-text-el");
    
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Start Veiledning';
        btn.classList.remove("btn-danger");
    }
    
    if (bubble) {
        bubble.className = "breathing-bubble";
    }
    
    if (text) {
        text.innerText = "Klar";
    }
    
    clearInterval(breathingInterval);
    isBreathingActive = false;
}

function runBreathingCycle(bubble, text) {
    if (!isBreathingActive) return;
    
    // 4-sekunders faser (Box Breathing)
    switch (breathingPhase) {
        case 0:
            text.innerText = "Pust inn...";
            bubble.classList.remove("exhale");
            bubble.classList.add("inhale");
            playTone(330, 'sine', 0.15); // Lav tone
            breathingPhase = 1;
            break;
        case 1:
            text.innerText = "Hold...";
            playTone(392, 'sine', 0.1); 
            breathingPhase = 2;
            break;
        case 2:
            text.innerText = "Pust ut...";
            bubble.classList.remove("inhale");
            bubble.classList.add("exhale");
            playTone(330, 'sine', 0.15); 
            breathingPhase = 3;
            break;
        case 3:
            text.innerText = "Hold...";
            playTone(392, 'sine', 0.1); 
            breathingPhase = 0;
            break;
    }
}

// -------------------------------------------------------------
// Lørdag: Indre Dialog / Skrytevegg (Day 6)
// -------------------------------------------------------------
function renderBrags() {
    const container = document.getElementById("brag-grid-container");
    if (!container) return;
    
    container.innerHTML = "";
    state.brags.forEach(b => {
        const card = document.createElement("div");
        card.className = "brag-card";
        
        // Gi kortet en svak tilfeldig rotasjon for autentisk look
        const randomRot = (Math.random() * 4 - 2).toFixed(1);
        card.style.transform = `rotate(${randomRot}deg)`;
        
        card.innerHTML = `
            <span>« ${b.text} »</span>
            <button class="delete-card-btn" onclick="deleteBragCard(${b.id})"><i class="fa-solid fa-circle-xmark"></i></button>
        `;
        container.appendChild(card);
    });
}

function addBragCard() {
    const input = document.getElementById("brag-input");
    if (!input || !input.value) return;
    
    state.brags.push({
        id: Date.now(),
        text: input.value
    });
    
    input.value = "";
    saveState();
    renderBrags();
    renderDayHeader();
    updateTimelineStatusIcons();
    playSuccessBeep();
}

function deleteBragCard(id) {
    state.brags = state.brags.filter(b => b.id !== id);
    saveState();
    renderBrags();
    renderDayHeader();
    updateTimelineStatusIcons();
}

// -------------------------------------------------------------
// Søndag: Perspektiv & Evaluering (Day 7)
// -------------------------------------------------------------
function renderSundayModule() {
    document.getElementById("eval-takeaway").value = state.sundayEval.takeaway || "";
    document.getElementById("eval-standard").value = state.sundayEval.standard || "";
    document.getElementById("eval-reward").value = state.sundayEval.reward || "";
    
    checkSundayCompletion();
}

function saveSundayEval() {
    state.sundayEval.takeaway = document.getElementById("eval-takeaway").value;
    state.sundayEval.standard = document.getElementById("eval-standard").value;
    state.sundayEval.reward = document.getElementById("eval-reward").value;
    
    saveState();
    renderDayHeader();
    updateTimelineStatusIcons();
    checkSundayCompletion();
}

function checkSundayCompletion() {
    const congrats = document.getElementById("congrats-finish-panel");
    if (isDayTaskCompleted(7)) {
        congrats.style.display = "flex";
        
        // Fyr av konfetti automatisk første gang de fyller den ut
        if (localStorage.getItem("helvetesuka-completed-celebrated") !== "true") {
            setTimeout(triggerConfetti, 300);
            localStorage.setItem("helvetesuka-completed-celebrated", "true");
        }
    } else {
        congrats.style.display = "none";
    }
}

function triggerConfetti() {
    try {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#00f2fe', '#9d4edd', '#10b981', '#ffffff']
        });
        playSuccessBeep();
    } catch(e) {
        console.warn("Konfetti feilet:", e);
    }
}

// -------------------------------------------------------------
// Informasjon & Instillinger
// -------------------------------------------------------------
function openInstructionsModal() {
    document.getElementById("instructions-modal").classList.add("active");
}

function closeInstructionsModal() {
    document.getElementById("instructions-modal").classList.remove("active");
}

// Fargetema-bytting (lys/mørk modus)
function toggleColorScheme() {
    let currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    document.querySelector('meta[name="color-scheme"]').content = newTheme;
    localStorage.setItem("color-scheme", newTheme);
    
    playTone(500, 'sine', 0.05);
}

// Tilbakestill applikasjon
function confirmReset() {
    if (confirm("Er du sikker på at du vil nullstille Helvetesuka? Alle dine lagrede data, dagboksnotater og planer vil bli slettet permanent.")) {
        localStorage.removeItem("helvetesuka-state");
        localStorage.removeItem("helvetesuka-completed-celebrated");
        location.reload();
    }
}

// -------------------------------------------------------------
// Forberedelsesdag: Prep Day (Day 0)
// -------------------------------------------------------------
function renderPrepDay() {
    const prepItems = ['food', 'clothes', 'social', 'alarms', 'workspace'];
    const completed = state.prepCompleted || [];
    
    prepItems.forEach(item => {
        const checkbox = document.getElementById(`prep-${item}`);
        const container = document.getElementById(`prep-item-${item}`);
        if (checkbox) {
            const isChecked = completed.includes(item);
            checkbox.checked = isChecked;
            
            if (container) {
                if (isChecked) {
                    container.classList.add("checked");
                } else {
                    container.classList.remove("checked");
                }
            }
        }
    });
    
    const textarea = document.getElementById("prep-intentions");
    if (textarea) {
        textarea.value = state.prepIntentions || "";
    }
}

function togglePrepItem(itemId) {
    if (!state.prepCompleted) {
        state.prepCompleted = [];
    }
    
    const index = state.prepCompleted.indexOf(itemId);
    if (index > -1) {
        state.prepCompleted.splice(index, 1);
    } else {
        state.prepCompleted.push(itemId);
        playTone(700, 'sine', 0.08); // Liten klikkelyd
    }
    
    saveState();
    renderDayHeader();
    renderPrepDay();
    updateTimelineStatusIcons();
}

function savePrepIntentions() {
    const val = document.getElementById("prep-intentions").value;
    state.prepIntentions = val;
    saveState();
    renderDayHeader();
    updateTimelineStatusIcons();
}

// -------------------------------------------------------------
// PWA Service Worker registrering
// -------------------------------------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registrert med scope:', reg.scope))
            .catch(err => console.error('Service Worker registrering feilet:', err));
    });
}

// -------------------------------------------------------------
// Visningsmodus toggling (Dashboard vs Historikk)
// -------------------------------------------------------------
function switchViewMode(mode) {
    const tabDashboard = document.getElementById("tab-dashboard-btn");
    const tabHistory = document.getElementById("tab-history-btn");
    const viewDashboard = document.getElementById("view-dashboard");
    const viewHistory = document.getElementById("view-history");
    
    if (!tabDashboard || !tabHistory || !viewDashboard || !viewHistory) return;
    
    if (mode === 'dashboard') {
        tabDashboard.classList.add("active");
        tabHistory.classList.remove("active");
        viewDashboard.classList.add("active");
        viewHistory.classList.remove("active");
    } else if (mode === 'history') {
        tabDashboard.classList.remove("active");
        tabHistory.classList.add("active");
        viewDashboard.classList.remove("active");
        viewHistory.classList.add("active");
        renderHistory();
    }
    
    playTone(500, 'sine', 0.05);
}

// -------------------------------------------------------------
// Lydbilde Generator (Web Audio API Synthesizer)
// -------------------------------------------------------------
let focusSounds = {
    white: { node: null, gain: null, isPlaying: false, vol: 0.3 },
    rain: { node: null, gain: null, isPlaying: false, vol: 0.3, lfo: null },
    binaural: { nodeLeft: null, nodeRight: null, gain: null, isPlaying: false, vol: 0.3 }
};

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function toggleSoundscapePanel() {
    const drawer = document.getElementById("soundscape-drawer");
    if (drawer) {
        drawer.classList.toggle("active");
        playTone(500, 'sine', 0.05);
    }
}

function toggleNoise(type) {
    initAudioContext();
    const playBtn = document.getElementById(`sound-${type}-play`);
    if (!focusSounds[type].isPlaying) {
        focusSounds[type].isPlaying = true;
        if (type === 'white') startWhiteNoise();
        else if (type === 'rain') startRainNoise();
        else if (type === 'binaural') startBinauralBeats();
        
        if (playBtn) {
            playBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stopp';
            playBtn.classList.add("playing");
        }
    } else {
        focusSounds[type].isPlaying = false;
        if (type === 'white') stopWhiteNoise();
        else if (type === 'rain') stopRainNoise();
        else if (type === 'binaural') stopBinauralBeats();
        
        if (playBtn) {
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Spill';
            playBtn.classList.remove("playing");
        }
    }
}

function adjustVolume(type, val) {
    const volFloat = parseFloat(val);
    focusSounds[type].vol = volFloat;
    if (focusSounds[type].gain) {
        const multiplier = type === 'binaural' ? 0.5 : 1.0;
        focusSounds[type].gain.gain.setValueAtTime(volFloat * multiplier, audioCtx.currentTime);
    }
}

function startWhiteNoise() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(focusSounds.white.vol, audioCtx.currentTime);
    
    noiseNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseNode.start();
    focusSounds.white.node = noiseNode;
    focusSounds.white.gain = gainNode;
}

function stopWhiteNoise() {
    if (focusSounds.white.node) {
        try { focusSounds.white.node.stop(); } catch(e){}
        focusSounds.white.node = null;
    }
    focusSounds.white.gain = null;
}

function startRainNoise() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.0, audioCtx.currentTime);
    filter.frequency.setValueAtTime(450, audioCtx.currentTime);
    
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, audioCtx.currentTime); // Langsom bølge
    
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(200, audioCtx.currentTime); // Modulerer filterfrekvensen +/- 200Hz
    
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(focusSounds.rain.vol, audioCtx.currentTime);
    
    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseNode.start();
    lfo.start();
    
    focusSounds.rain.node = noiseNode;
    focusSounds.rain.lfo = lfo;
    focusSounds.rain.gain = gainNode;
}

function stopRainNoise() {
    if (focusSounds.rain.node) {
        try { focusSounds.rain.node.stop(); } catch(e){}
        focusSounds.rain.node = null;
    }
    if (focusSounds.rain.lfo) {
        try { focusSounds.rain.lfo.stop(); } catch(e){}
        focusSounds.rain.lfo = null;
    }
    focusSounds.rain.gain = null;
}

function startBinauralBeats() {
    const oscLeft = audioCtx.createOscillator();
    oscLeft.frequency.setValueAtTime(200, audioCtx.currentTime); // 200 Hz i venstre øre
    oscLeft.type = 'sine';
    
    const oscRight = audioCtx.createOscillator();
    oscRight.frequency.setValueAtTime(210, audioCtx.currentTime); // 210 Hz i høyre øre (10 Hz diff = alpha)
    oscRight.type = 'sine';
    
    const merger = audioCtx.createChannelMerger(2);
    
    const gainNode = audioCtx.createGain();
    // Binaurale toner bør spilles mykt for optimal effekt
    gainNode.gain.setValueAtTime(focusSounds.binaural.vol * 0.4, audioCtx.currentTime);
    
    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);
    
    merger.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscLeft.start();
    oscRight.start();
    
    focusSounds.binaural.nodeLeft = oscLeft;
    focusSounds.binaural.nodeRight = oscRight;
    focusSounds.binaural.gain = gainNode;
}

function stopBinauralBeats() {
    if (focusSounds.binaural.nodeLeft) {
        try { focusSounds.binaural.nodeLeft.stop(); } catch(e){}
        focusSounds.binaural.nodeLeft = null;
    }
    if (focusSounds.binaural.nodeRight) {
        try { focusSounds.binaural.nodeRight.stop(); } catch(e){}
        focusSounds.binaural.nodeRight = null;
    }
    focusSounds.binaural.gain = null;
}

// -------------------------------------------------------------
// Nettleservarsler (Notifications)
// -------------------------------------------------------------
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert("Denne nettleseren støtter ikke skrivebordsvarsler.");
        return;
    }
    
    Notification.requestPermission().then(permission => {
        updateNotificationIcon();
        if (permission === 'granted') {
            showLocalNotification(
                "Helvetesuka Varslinger Aktivert! 🔔", 
                "Du vil nå motta påminnelser kl. 05:00 og 22:00. NB: På iOS kreves PWA installert på hjemskjerm."
            );
            playSuccessBeep();
        } else {
            alert("Varslingstillatelse ble avvist. Du kan endre dette i nettleserens innstillinger.");
        }
    });
}

function updateNotificationIcon() {
    const btn = document.getElementById("notifications-btn");
    if (!btn) return;
    
    if (!('Notification' in window)) {
        btn.style.display = "none";
        return;
    }
    
    if (Notification.permission === 'granted') {
        btn.style.color = "var(--neon-accent)";
        btn.innerHTML = '<i class="fa-solid fa-bell"></i>';
        btn.title = "Varslinger er aktivert";
    } else if (Notification.permission === 'denied') {
        btn.style.color = "var(--neon-danger)";
        btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i>';
        btn.title = "Varslinger er blokkert av nettleseren";
    } else {
        btn.style.color = "";
        btn.innerHTML = '<i class="fa-solid fa-bell"></i>';
        btn.title = "Aktiver nettleservarsler for morgen- og kveldsregler";
    }
}

function showLocalNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const options = {
        body: body,
        icon: 'assets/favicon.png',
        badge: 'assets/favicon.png',
        vibrate: [200, 100, 200]
    };
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}

function startNotificationScheduler() {
    // Sjekk hvert 60. sekund
    setInterval(() => {
        if (!state.isActive || !('Notification' in window) || Notification.permission !== 'granted') return;
        
        const now = new Date();
        const hrs = now.getHours();
        const mins = now.getMinutes();
        
        // Morgenrutine: Stå opp kl. 05:00
        if (hrs === 5 && mins === 0) {
            showLocalNotification(
                "Helvetesuka: Krysse linjen! 🚀", 
                "Klokken er 05:00! Kom deg ut av senga, drikk et glass vann, og start din planlagte morgenøkt med energi."
            );
        }
        
        // Kveldsrutine: Legge seg kl. 22:00 (unntatt torsdag natt)
        if (hrs === 22 && mins === 0) {
            calculateCurrentRealDay();
            if (state.activeDay !== 4) { // Ikke torsdag døgning
                showLocalNotification(
                    "Helvetesuka: Restitusjon! 💤", 
                    "Klokken er 22:00! Slukk lyset og lukk øynene nå. Tilstrekkelig søvn er nøkkelen til morgendagens suksess."
                );
            } else {
                showLocalNotification(
                    "Helvetesuka: Døgningen starter! 🦉", 
                    "Det er torsdag kveld! Ingen søvn i natt. Vær fokusert, ta i et tak, og husk å sjekke inn på checkpointene."
                );
            }
        }
        
        // Torsdag natt / fredag morgen sjekkpunkter for all-nighter
        if (hrs === 0 && mins === 0) {
            calculateCurrentRealDay();
            if (state.activeDay === 4 || state.activeDay === 5) {
                showLocalNotification("All-nighter Checkpoint #1", "Klokken er 00:00! Du er i gang med natten. Sjekk inn i appen.");
            }
        }
        if (hrs === 2 && mins === 0) {
            calculateCurrentRealDay();
            if (state.activeDay === 5) {
                showLocalNotification("All-nighter Checkpoint #2", "Klokken er 02:00! Natten er mørkest nå, men du har stålkontroll. Fortsett!");
            }
        }
        if (hrs === 4 && mins === 0) {
            calculateCurrentRealDay();
            if (state.activeDay === 5) {
                showLocalNotification("All-nighter Checkpoint #3", "Klokken er 04:00! Morgengryet nærmer seg. Hold koken litt til!");
            }
        }
    }, 60000);
}

// -------------------------------------------------------------
// Delingskort og Delingsmodal
// -------------------------------------------------------------
function openShareModal() {
    const modal = document.getElementById("share-modal");
    const preview = document.getElementById("share-preview-text");
    if (!modal || !preview) return;
    
    const startStr = state.startDate || new Date().toISOString().split("T")[0];
    const startD = new Date(startStr);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
    
    const formattedStart = `${startD.getDate()}.${startD.getMonth()+1}.${startD.getFullYear()}`;
    const formattedEnd = `${endD.getDate()}.${endD.getMonth()+1}.${endD.getFullYear()}`;
    
    const progressList = [];
    for (let d = 1; d <= 7; d++) {
        progressList.push(calculateDayProgress(d));
    }
    const totalAvg = Math.round(progressList.reduce((a, b) => a + b, 0) / 7);
    
    const dateKeyTO = getFormattedDateKey(4);
    const checkpointsCount = (state.checkpoints[dateKeyTO] || []).length;
    
    const takeaway = state.sundayEval.takeaway || "Ikke registrert";
    const standard = state.sundayEval.standard || "Ikke registrert";
    const reward = state.sundayEval.reward || "Ikke registrert";
    
    const text = `🔥 JEG HAR FULLFØRT HELVETESUKA! 🔥
Gjennomført i vanlig jobbuke (${formattedStart} - ${formattedEnd})

📊 Mine daglige resultater:
• Mandag (Vaner): ${progressList[0]}%
• Tirsdag (Fokus): ${progressList[1]}%
• Onsdag (Tidsstyring): ${progressList[2]}%
• Torsdag (Komfortsone): ${progressList[3]}% (All-nighter sjekkpunkter: ${checkpointsCount}/4)
• Fredag (Restitusjon): ${progressList[4]}% (Powernap fullført!)
• Lørdag (Indre dialog): ${progressList[5]}%
• Søndag (Perspektiv): ${progressList[6]}%

🏆 Total fullføringsgrad: ${totalAvg}%

💡 Min største aha-opplevelse:
"${takeaway}"

💪 Mine nye standarder for jobbuka:
"${standard}"

🎁 Min søndagsbelønning:
"${reward}"

Kalkulert i Helvetesuka Web App. Klarer du det samme?`;

    preview.innerText = text;
    modal.classList.add("active");
    playTone(500, 'sine', 0.05);
}

// Global modal close logic
function closeShareModal() {
    const modal = document.getElementById("share-modal");
    if (modal) {
        modal.classList.remove("active");
        playTone(500, 'sine', 0.05);
    }
}

function copyShareText() {
    const preview = document.getElementById("share-preview-text");
    if (!preview) return;
    
    navigator.clipboard.writeText(preview.innerText)
        .then(() => {
            alert("Ukesoppsummeringen er kopiert til utklippstavlen!");
            closeShareModal();
            playSuccessBeep();
        })
        .catch(err => {
            console.error("Feil ved kopiering til clipboard:", err);
            alert("Kunne ikke kopiere automatisk. Marker teksten og kopier manuelt.");
        });
}

// -------------------------------------------------------------
// Historikk & Ukes-arkivering
// -------------------------------------------------------------
function updateHistoryBadge() {
    const badge = document.getElementById("history-count-badge");
    if (!badge) return;
    
    const count = (state.history || []).length;
    if (count > 0) {
        badge.innerText = count;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

function archiveCurrentWeek() {
    if (!state.sundayEval.takeaway || !state.sundayEval.standard || !state.sundayEval.reward) {
        alert("Vennligst fyll ut hele søndagsevalueringen før du arkiverer uken.");
        return;
    }
    
    if (!confirm("Er du sikker på at du vil arkivere denne Helvetesuka og nullstille dashboardet for en ny uke?")) {
        return;
    }
    
    // Regn ut resultater
    const progressList = [];
    for (let d = 1; d <= 7; d++) {
        progressList.push(calculateDayProgress(d));
    }
    const totalAvg = Math.round(progressList.reduce((a, b) => a + b, 0) / 7);
    
    const dateKeyTO = getFormattedDateKey(4);
    const checkpointsCount = (state.checkpoints[dateKeyTO] || []).length;
    
    // Bygg historikk-element
    const archiveItem = {
        id: Date.now(),
        startDate: state.startDate,
        progress: totalAvg,
        checkpoints: checkpointsCount,
        takeaway: state.sundayEval.takeaway,
        standard: state.sundayEval.standard,
        reward: state.sundayEval.reward,
        dailyProgress: progressList
    };
    
    if (!state.history) {
        state.history = [];
    }
    state.history.push(archiveItem);
    
    // Nullstill aktive felter for ny Helvetesuke
    state.isActive = false;
    state.startDate = '';
    state.activeDay = 1;
    state.completedRules = {};
    state.journals = {};
    state.modeLog = {};
    state.activeMode = {};
    state.activeModeReflection = {};
    state.timeBlocks = {};
    state.comfortActions = [];
    state.checkpoints = {};
    state.sundayEval = { takeaway: '', standard: '', reward: '' };
    state.prepCompleted = [];
    state.prepIntentions = '';
    
    // Fjern feirings-flagg
    localStorage.removeItem("helvetesuka-completed-celebrated");
    
    saveState();
    updateHistoryBadge();
    
    // Avspill en fin lydsekvens
    playSuccessBeep();
    setTimeout(() => {
        playTone(659.25, 'triangle', 0.15); // E5
        setTimeout(() => playTone(880.00, 'triangle', 0.35), 100); // A5
    }, 150);
    
    alert("Ukens resultater har blitt arkivert i historikken din!");
    
    // Gå tilbake til onboarding
    setupOnboardingDefaults();
    showScreen("onboarding-screen");
}

function toggleHistoryCard(headerEl) {
    const cardBody = headerEl.nextElementSibling;
    if (!cardBody) return;
    
    const icon = headerEl.querySelector(".collapse-icon");
    const isExpanded = cardBody.style.display !== "none";
    
    if (isExpanded) {
        cardBody.style.display = "none";
        if (icon) {
            icon.classList.remove("fa-chevron-up");
            icon.classList.add("fa-chevron-down");
        }
    } else {
        cardBody.style.display = "flex";
        if (icon) {
            icon.classList.remove("fa-chevron-down");
            icon.classList.add("fa-chevron-up");
        }
    }
    playTone(500, 'sine', 0.04);
}

function renderHistory() {
    const listContainer = document.getElementById("history-weeks-list");
    const chartWrapper = document.getElementById("chart-section-wrapper");
    const chartGrid = document.getElementById("history-chart-grid");
    
    const totalWeeksEl = document.getElementById("stats-total-weeks");
    const avgProgressEl = document.getElementById("stats-avg-progress");
    const totalCheckpointsEl = document.getElementById("stats-total-checkpoints");
    
    const historyList = state.history || [];
    
    // 1. Fyll ut statistikk
    if (totalWeeksEl) totalWeeksEl.innerText = historyList.length;
    
    if (historyList.length === 0) {
        if (avgProgressEl) avgProgressEl.innerText = "0%";
        if (totalCheckpointsEl) totalCheckpointsEl.innerText = "0";
        if (chartWrapper) chartWrapper.style.display = "none";
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="empty-history-message" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fa-solid fa-box-archive" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p style="margin: 0; font-size: 0.95rem;">Du har ingen arkiverte uker ennå. Fullfør din første Helvetesuke og arkiver den på søndag!</p>
                </div>
            `;
        }
        return;
    }
    
    let sumProgress = 0;
    let sumCheckpoints = 0;
    historyList.forEach(item => {
        sumProgress += item.progress || 0;
        sumCheckpoints += item.checkpoints || 0;
    });
    
    if (avgProgressEl) avgProgressEl.innerText = `${Math.round(sumProgress / historyList.length)}%`;
    if (totalCheckpointsEl) totalCheckpointsEl.innerText = sumCheckpoints;
    
    // 2. Progresjonsdiagram (siste 5 uker)
    if (chartWrapper && chartGrid) {
        chartWrapper.style.display = "block";
        chartGrid.innerHTML = "";
        
        const chartItems = historyList.slice(-5);
        chartItems.forEach((item, idx) => {
            const startD = new Date(item.startDate);
            const dateLabel = `${startD.getDate()}.${startD.getMonth()+1}`;
            
            const barWrapper = document.createElement("div");
            barWrapper.className = "chart-bar-wrapper";
            barWrapper.innerHTML = `
                <div class="chart-bar" style="height: ${item.progress}%;">
                    <span class="chart-bar-value">${item.progress}%</span>
                </div>
                <span class="chart-bar-label">Uke ${idx + 1}<br><span style="font-size:0.7rem; color:var(--text-muted);">${dateLabel}</span></span>
            `;
            chartGrid.appendChild(barWrapper);
        });
    }
    
    // 3. Tegn historikk-liste (nyeste øverst)
    if (listContainer) {
        listContainer.innerHTML = "";
        
        historyList.slice().reverse().forEach((item, revIdx) => {
            const idx = historyList.length - 1 - revIdx; // Opprinnelig index
            const startD = new Date(item.startDate);
            const endD = new Date(startD);
            endD.setDate(startD.getDate() + 6);
            
            const formattedStart = `${startD.getDate()}.${startD.getMonth()+1}.${startD.getFullYear()}`;
            const formattedEnd = `${endD.getDate()}.${endD.getMonth()+1}.${endD.getFullYear()}`;
            
            const card = document.createElement("div");
            card.className = "history-week-card glass-container";
            
            const dagerNavn = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
            let dailyProgressHTML = "";
            (item.dailyProgress || [0,0,0,0,0,0,0]).forEach((dp, dIdx) => {
                dailyProgressHTML += `
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">
                        <span style="min-width: 60px;">${dagerNavn[dIdx]}:</span>
                        <div style="display: flex; align-items: center; flex-grow: 1; margin: 0 10px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${dp}%; height: 100%; background: var(--neon-accent); border-radius: 3px;"></div>
                        </div>
                        <span style="font-weight: 600; color: var(--text-primary); min-width: 30px; text-align: right;">${dp}%</span>
                    </div>
                `;
            });
            
            card.innerHTML = `
                <div class="history-week-header" onclick="toggleHistoryCard(this)">
                    <div>
                        <h5 style="margin: 0; font-family: var(--font-heading); font-size: 1.05rem; font-weight: 600;">Uke ${idx + 1}</h5>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);"><i class="fa-regular fa-calendar-days" style="margin-right: 4px;"></i> ${formattedStart} - ${formattedEnd}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span class="total-progress-badge" style="background: rgba(0, 242, 254, 0.15); color: var(--neon-accent); border: 1px solid var(--neon-accent); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px;">${item.progress}% Fullført</span>
                        <i class="fa-solid fa-chevron-up collapse-icon" style="color: var(--text-muted); font-size: 0.9rem;"></i>
                    </div>
                </div>
                <div class="history-week-body" style="display: flex;">
                    <div class="history-week-grid" style="width: 100%;">
                        <div class="history-week-details">
                            <p style="margin: 0 0 10px 0; font-size: 0.85rem;">
                                <strong style="display: block; color: var(--text-primary); margin-bottom: 2px;">Største aha-opplevelse:</strong>
                                <span style="font-style: italic; color: var(--text-secondary);">« ${item.takeaway || 'Ingen registrering'} »</span>
                            </p>
                            <p style="margin: 0 0 10px 0; font-size: 0.85rem;">
                                <strong style="display: block; color: var(--text-primary); margin-bottom: 2px;">Nye standarder for jobbuka:</strong>
                                <span style="font-style: italic; color: var(--text-secondary);">« ${item.standard || 'Ingen registrering'} »</span>
                            </p>
                            <p style="margin: 0 0 10px 0; font-size: 0.85rem;">
                                <strong style="display: block; color: var(--text-primary); margin-bottom: 2px;">Søndagsbelønning:</strong>
                                <span style="font-style: italic; color: var(--text-secondary);">« ${item.reward || 'Ingen registrering'} »</span>
                            </p>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">
                                <span><i class="fa-solid fa-moon" style="margin-right: 5px;"></i> Døgning checkpoints: <strong>${item.checkpoints}/4</strong></span>
                            </div>
                        </div>
                        <div class="history-week-details">
                            <strong style="font-size: 0.85rem; color: var(--text-primary); display: block; margin-bottom: 8px;">Daglige resultater:</strong>
                            <div style="display: flex; flex-direction: column;">
                                ${dailyProgressHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            listContainer.appendChild(card);
        });
    }
}
