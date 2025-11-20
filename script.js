{
// --- CONSTANTS AND GAME STATE ---
const BUILDING_CODES = {
    GRASS: 0, TOWNHALL: 1, CANNON: 2, ARCHER_TOWER: 3,
    WIZARD_TOWER: 4, MONOLITH: 5, CREDIT_STORAGE: 6, BUILDER_HOUSE: 7,
    AIR_DEFENSE: 8, EAGLE_ARTILLERY: 9, INFERNO_TOWER: 10, MORTAR: 11,
    SPELL_TOWER: 12, HIDDEN_TESLA: 13, XBOW: 14, BARBARIAN_KING: 15
};

const UPGRADEABLE_DEFENSES = [
    BUILDING_CODES.CANNON, BUILDING_CODES.ARCHER_TOWER, BUILDING_CODES.WIZARD_TOWER,
    BUILDING_CODES.MONOLITH, BUILDING_CODES.AIR_DEFENSE, BUILDING_CODES.EAGLE_ARTILLERY,
    BUILDING_CODES.INFERNO_TOWER, BUILDING_CODES.MORTAR, BUILDING_CODES.SPELL_TOWER,
    BUILDING_CODES.HIDDEN_TESLA, BUILDING_CODES.XBOW
];

// ✅ NEW: Tutorial Slides Data
const TUTORIAL_SLIDES = [
    {
        title: "Welcome, Chief! ⚔️",
        icon: "👷‍♂️",
        text: "Welcome to <b>GANTTPLAY</b>! Your goal is to manage the village builder. Queue up upgrades by clicking buildings, but beware of <b>Golem Attacks</b>! You must choose the right scheduling algorithm to maximize efficiency."
    },
    {
        title: "FCFS Scheduling",
        icon: "📜",
        text: "<b>First-Come, First-Served (FCFS)</b>: The simplest algorithm. The builder handles tasks in the exact order they arrive. <br><i>Warning:</i> A long upgrade can block urgent short tasks (Convoy Effect)!"
    },
    {
        title: "SJF Scheduling",
        icon: "⏱️",
        text: "<b>Shortest Job First (SJF)</b>: The builder looks at the queue and picks the task with the shortest burst time. <br><i>Pros:</i> Reduces average waiting time. <br><i>Cons:</i> Large upgrades might never get done (Starvation)."
    },
    {
        title: "SRTF Scheduling",
        icon: "⚡",
        text: "<b>Shortest Remaining Time First (SRTF)</b>: A <b>Preemptive</b> version of SJF! If a new, shorter task arrives, the builder stops the current job immediately to finish the quick one first."
    },
    {
        title: "Priority Scheduling",
        icon: "🚨",
        text: "Tasks are assigned priority (Repairs > Upgrades). <br><b>Non-Preemptive:</b> Waits for current task to finish before running the high-priority one. <br><b>Preemptive:</b> Stops the current task immediately to handle the VIP task."
    },
    {
        title: "Round Robin (RR)",
        icon: "🔄",
        text: "<b>Round Robin</b>: The fairness algorithm! The builder works on a task for a set <b>Time Quantum</b> (e.g., 4s), then moves to the next task in line. This ensures every building gets some attention."
    }
];

const UPGRADE_COST = 50;
const UPGRADE_REWARD = 100;
const IGNORE_PENALTY = 100;

let credits = 200;
let currentTask = null;
let taskQueue = [];
let completedTasks = [];
let buildings = {};
let missions = [];
let taskIdCounter = 1;
let selectedAlgorithm = 'FCFS';
let gameTime = 0;
let attackTimer = null;
let attackInProgress = false;

// Round Robin variables
let timeQuantum = 4;
let currentTaskTimeSlice = 0; 

// --- DOM ELEMENTS ---
const gridContainer = document.getElementById('grid-container');
const creditsDisplay = document.getElementById('credits-display');
const taskQueueContainer = document.getElementById('task-queue');
const activityLogContainer = document.getElementById('activity-log');
const missionsList = document.getElementById('missions-list');
const algorithmSelect = document.getElementById('algorithm-select');
const tqContainer = document.getElementById('tq-container');
const tqInput = document.getElementById('time-quantum');

// --- INITIALIZATION ---
function initGame() {
    PRESET_BUILDINGS.forEach(b => {
        const buildingId = `${getBuildingName(b.code).replace(/\s/g, '_')}_${b.x}_${b.y}`;
        buildings[buildingId] = { ...b, id: buildingId, isUnderAttack: false, isDamaged: false };
    });
    renderGrid();
    updateUI();

    document.getElementById('edit-layout-btn').addEventListener('click', () => alert('Edit Base Layout feature coming soon!'));
    
    function handleDifficultyClick(min, max, difficultyName) {
        generateMissions(min, max);
        startAttackTimer();
        ['btn-easy', 'btn-medium', 'btn-hard'].forEach(id => document.getElementById(id).disabled = true);
        addLogEntry(`Game started on ${difficultyName} difficulty.`);
        document.querySelector('.difficulty-section h3').textContent = `Difficulty: ${difficultyName}`;
    }

    document.getElementById('btn-easy').addEventListener('click', () => handleDifficultyClick(4, 6, 'Easy'));
    document.getElementById('btn-medium').addEventListener('click', () => handleDifficultyClick(6, 7, 'Medium'));
    document.getElementById('btn-hard').addEventListener('click', () => handleDifficultyClick(8, 10, 'Hard'));

    algorithmSelect.addEventListener('change', (e) => {
        selectedAlgorithm = e.target.value;
        addLogEntry(`Algorithm changed to ${algorithmSelect.options[algorithmSelect.selectedIndex].text}.`);
        
        if (selectedAlgorithm === 'RR') {
            tqContainer.style.display = 'block';
        } else {
            tqContainer.style.display = 'none';
        }

        updateMissionsUI(); 
        updateQueueUI(); 
    });

    tqInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (val > 0) {
            timeQuantum = val;
            addLogEntry(`Time Quantum set to ${timeQuantum}s.`);
        } else {
            tqInput.value = timeQuantum; 
        }
    });
    // ✅ CHANGED: Launch tutorial first, start game clock only after tutorial closes
    showTutorialPopup(() => {
        setInterval(gameTick, 1000);
    });
}

// ✅ NEW: Tutorial Popup Function
function showTutorialPopup(onCloseCallback) {
    let currentSlideIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.id = 'tutorial-overlay';

    // Create Content Structure
    overlay.innerHTML = `
        <div class="popup-content tutorial-popup">
            <div class="tutorial-slide-header">
                <h2 id="tut-title"></h2>
            </div>
            <div class="tutorial-slide-content">
                <div id="tut-icon" class="tutorial-icon"></div>
                <p id="tut-text"></p>
            </div>
            
            <div class="tutorial-nav-container">
                <button id="btn-tut-prev" class="btn-tutorial">Back</button>
                
                <div class="tutorial-dots" id="tut-dots">
                    </div>
                
                <button id="btn-tut-next" class="btn-tutorial primary">Next</button>
            </div>
             <div style="text-align: center; margin-top: 10px;">
                <button id="btn-tut-skip" style="background:none; border:none; color: #7a5f3d; text-decoration: underline; cursor: pointer;">Skip Tutorial</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Elements
    const titleEl = document.getElementById('tut-title');
    const textEl = document.getElementById('tut-text');
    const iconEl = document.getElementById('tut-icon');
    const btnPrev = document.getElementById('btn-tut-prev');
    const btnNext = document.getElementById('btn-tut-next');
    const btnSkip = document.getElementById('btn-tut-skip');
    const dotsContainer = document.getElementById('tut-dots');

    // Generate Dots
    TUTORIAL_SLIDES.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if(idx === 0) dot.classList.add('active');
        dotsContainer.appendChild(dot);
    });

    function updateSlide(index) {
        const slide = TUTORIAL_SLIDES[index];
        titleEl.textContent = slide.title;
        textEl.innerHTML = slide.text;
        iconEl.textContent = slide.icon;

        // Update Dots
        document.querySelectorAll('.dot').forEach((d, i) => {
            d.classList.toggle('active', i === index);
        });

        // Update Buttons
        btnPrev.disabled = index === 0;
        if (index === TUTORIAL_SLIDES.length - 1) {
            btnNext.textContent = "Start Game!";
        } else {
            btnNext.textContent = "Next";
        }
    }

    function closeTutorial() {
        document.body.removeChild(overlay);
        if (onCloseCallback) onCloseCallback();
    }

    // Event Listeners
    btnPrev.addEventListener('click', () => {
        if (currentSlideIndex > 0) {
            currentSlideIndex--;
            updateSlide(currentSlideIndex);
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentSlideIndex < TUTORIAL_SLIDES.length - 1) {
            currentSlideIndex++;
            updateSlide(currentSlideIndex);
        } else {
            closeTutorial();
        }
    });

    btnSkip.addEventListener('click', closeTutorial);

    // Initialize first slide
    updateSlide(0);
}


// --- RENDERING AND UI ---
function renderGrid() {
    gridContainer.innerHTML = '';
    Object.values(buildings).forEach(b => gridContainer.appendChild(createBuildingElement(b)));
}

function createBuildingElement(buildingData) {
    const buildingEl = document.createElement('div');
    buildingEl.className = 'building';
    buildingEl.dataset.buildingId = buildingData.id;
    buildingEl.style.gridColumn = `${buildingData.x + 1} / span 4`;
    buildingEl.style.gridRow = `${buildingData.y + 1} / span 4`;

    const img = document.createElement('img');
    img.src = buildingData.img;
    img.onerror = function() {
        this.src = `https://placehold.co/100x100/7a5f3d/fdf5e6?text=${getBuildingName(buildingData.code)}`;
        this.onerror = null;
    };
    buildingEl.appendChild(img);


    const badge = document.createElement('div');
    badge.className = 'level-badge';
    badge.textContent = `Lv. ${buildingData.level}`;
    buildingEl.appendChild(badge);

    if (UPGRADEABLE_DEFENSES.includes(buildingData.code)) {
        const tip = document.createElement('div');
        tip.className = 'upgrade-tooltip';
        if (buildingData.isDamaged) {
            tip.innerHTML = `<div class="tooltip-title">Repair Now</div><button class="btn-upgrade">Cost: 30💰</button>`;
            tip.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); handleRepairClick(buildingData.id); });
        } else {
            tip.innerHTML = `<div class="tooltip-title">${getBuildingName(buildingData.code)}</div><div>⚒️ Upgrade Now</div><button class="btn-upgrade">Cost: ${UPGRADE_COST}💰</button>`;
            tip.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); handleUpgradeClick(buildingData.id); });
        }
        buildingEl.appendChild(tip);
    }
    return buildingEl;
}

function handleRepairClick(buildingId)
{
    const building = buildings[buildingId];
    if (!building || !building.isDamaged) return;

    const repairCost = 30;
    if (credits < repairCost) {
        addLogEntry('Not enough credits to repair!');
        return;
    }
    if (taskQueue.some(t => t.buildingId === buildingId && t.type === 'Repair') || (currentTask && currentTask.buildingId === buildingId && currentTask.type === 'Repair')) {
        addLogEntry(`Repair for ${getBuildingName(building.code)} already in progress or queued.`);
        return;
    }

    credits -= repairCost;
    const repairMission = missions.find(m => m.buildingId === buildingId && m.description.startsWith('Repair'));
    const burstTime = repairMission ? repairMission.burstTime : Math.floor(Math.random() * 4) + 2;

    const task = {
        id: `P_REP${taskIdCounter++}`, type: 'Repair', buildingId: buildingId,
        name: `Repair ${getBuildingName(building.code)}`, burstTime: burstTime, remainingTime: burstTime,
        status: 'Waiting', createdAt: gameTime, segments: [],
        priority: 0, 
        lastQueuedAt: gameTime
    };
    taskQueue.push(task);
    addLogEntry(`QUEUED: ${task.id} (${task.name}, Burst: ${burstTime}s).`);
    updateUI();
}


function updateBuildingIcons() {
    document.querySelectorAll('.building-icon').forEach(icon => icon.remove());
    Object.values(buildings).forEach(b => {
        const buildingEl = document.querySelector(`.building[data-building-id='${b.id}']`);
        if (!buildingEl) return;

        if (b.isDamaged) addIcon(buildingEl, '🔥');
        else if (b.isUnderAttack) addIcon(buildingEl, '🎯');

        if (currentTask && currentTask.buildingId === b.id) {
             if (currentTask.type === 'Upgrade' || currentTask.type === 'Repair') {
                addIcon(buildingEl, '🔨');
            }
        } else if (taskQueue.some(t => t.buildingId === b.id && t.status === 'Waiting' && t.segments.length > 0)) {
            addIcon(buildingEl, '⏸️');
        }
    });
}


function addIcon(element, icon, isFlashing = false) {
    const existingIcon = element.querySelector(`.building-icon`);
    if (existingIcon && existingIcon.textContent === icon) return;
    if (existingIcon) existingIcon.remove();

    const iconEl = document.createElement('span');
    iconEl.className = 'building-icon';
    if(isFlashing) iconEl.classList.add('shield');
    iconEl.textContent = icon;
    element.appendChild(iconEl);
}

// --- ATTACK LOGIC ---
function startAttackTimer() {
    if (attackTimer) clearTimeout(attackTimer);
    const scheduleNextAttack = () => {
        const delay = (Math.floor(Math.random() * 5) + 5) * 1000;
        attackTimer = setTimeout(() => {
            const isPreemptive = ['SRTF', 'PriorityP', 'RR'].includes(selectedAlgorithm);

            if (isPreemptive && currentTask && currentTask.type === 'Upgrade' && !attackInProgress && !document.querySelector('#attack-popup-overlay')) {
                triggerAttack();
            }
             if (!document.querySelector('#attack-popup-overlay')) {
               scheduleNextAttack();
            }
        }, delay);
    };
    scheduleNextAttack();
}

function triggerAttack() {
    if (attackInProgress || document.querySelector('#attack-popup-overlay')) return;
    attackInProgress = true;
    addLogEntry("Warning! A Golem is approaching the village!");

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.id = 'attack-popup-overlay';
    overlay.innerHTML = `
        <div class="attack-popup-content">
             <img src='images/golem.png' alt='Golem attacking' onerror="this.src='https://placehold.co/120x120/7a5f3d/fdf5e6?text=Golem'; this.onerror=null;">
            <h2>Village Under Attack!</h2>
            <p>Your builder must defend the village. This will preempt your current upgrade.</p>
            <div class="attack-popup-buttons">
                <button id="btn-defend">Defend Now</button>
                <button id="btn-ignore">Not Now</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const townhallEl = document.querySelector(`.building[data-building-id*='Townhall']`);
    if(townhallEl) addIcon(townhallEl, '🛡️', true);

    document.getElementById('btn-defend').onclick = () => handleDefend(overlay);
    document.getElementById('btn-ignore').onclick = () => handleIgnore(overlay);
}

function handleDefend(overlay) {
    if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay);
    attackInProgress = false;
    addLogEntry("Builder is defending the village!");
    const defenseTasks = [
        { name: 'Repel Golems', burst: 3 },
        { name: 'Douse Fires', burst: 2 },
    ];
    const totalDefenseTime = defenseTasks.reduce((sum, t) => sum + t.burst, 0);
    addLogEntry(`Defense will take ${totalDefenseTime}s.`);

    defenseTasks.forEach(dt => {
        const task = {
            id: `P_DEF${taskIdCounter++}`, type: 'Defense', name: dt.name,
            burstTime: dt.burst, remainingTime: dt.burst, status: 'Waiting',
            createdAt: gameTime, segments: [], buildingId: null,
            priority: -1, 
            lastQueuedAt: gameTime 
        };
        taskQueue.unshift(task); 
    });
}

function handleIgnore(overlay) {
    if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay);
    attackInProgress = false;
    
    if (currentTask && (currentTask.type === 'Upgrade' || currentTask.type === 'Repair')) {
        const failedTaskName = currentTask.name;
        const building = buildings[currentTask.buildingId];
        
        addLogEntry(`Attack ignored! Task ${currentTask.id} (${failedTaskName}) has FAILED.`);
        currentTask = null; 
        
        credits = Math.max(0, credits - IGNORE_PENALTY);
        addLogEntry(`You were fined ${IGNORE_PENALTY} credits for failing to defend the builder!`);

        if (building) {
            building.isDamaged = true;
            addLogEntry(`The ${getBuildingName(building.code)} was damaged in the attack!`);
            
            missions.push({
                id: `mission_REPAIR_${building.code}${taskIdCounter++}`,
                buildingId: building.id,
                description: `Repair ${getBuildingName(building.code)}`,
                burstTime: Math.floor(Math.random() * 4) + 2,
                completed: false,
                priority: 0 
            });
            updateMissionsUI();
        }
        
    } else {
        addLogEntry("Attack ignored! The Golem pillaged the village!");
        credits = Math.max(0, credits - IGNORE_PENALTY);
    }

    updateUI(); 
}


// --- SCHEDULING & GAME LOGIC ---
function gameTick() {
    // Time Quantum Check for RR
    if (selectedAlgorithm === 'RR' && currentTask && currentTask.type !== 'Defense' && currentTaskTimeSlice >= timeQuantum) {
        addLogEntry(`TIME QUANTUM END: ${currentTask.name} preempted.`);
        currentTask.status = 'Waiting';
        if (currentTask.segments.length > 0) { 
             currentTask.segments[currentTask.segments.length - 1].end = gameTime;
        }
        currentTask.lastQueuedAt = gameTime; 
        taskQueue.push(currentTask); 
        currentTask = null;
        currentTaskTimeSlice = 0;
    }

    // --- Task Selection Logic ---
    let bestTask = null;
    const readyTasks = [...taskQueue, ...(currentTask ? [currentTask] : [])];

    if (readyTasks.length > 0) {
        const defenseTasks = readyTasks.filter(t => t.type === 'Defense');
        if (defenseTasks.length > 0) {
             bestTask = defenseTasks.reduce((min, t) => t.remainingTime < min.remainingTime ? t : min);
        } else {
            const nonDefenseTasks = readyTasks.filter(t => t.type !== 'Defense');
            if (nonDefenseTasks.length > 0) {
                switch (selectedAlgorithm) {
                    case 'SJF':
                        if (!currentTask && taskQueue.length > 0) {
                             const nonDefenseQueue = taskQueue.filter(t => t.type !== 'Defense');
                             if (nonDefenseQueue.length > 0) bestTask = nonDefenseQueue.reduce((min, t) => t.burstTime < min.burstTime ? t : min);
                        } else {
                            bestTask = currentTask; 
                        }
                        break;
                    
                    case 'SRTF':
                        bestTask = nonDefenseTasks.reduce((min, t) => t.remainingTime < min.remainingTime ? t : min);
                        break;

                    case 'PriorityNP':
                        if (!currentTask && taskQueue.length > 0) {
                            bestTask = taskQueue.reduce((min, t) => (t.priority ?? 99) < (min.priority ?? 99) ? t : min);
                        } else {
                            bestTask = currentTask; 
                        }
                        break;
                    
                    case 'PriorityP':
                        bestTask = nonDefenseTasks.reduce((min, t) => (t.priority ?? 99) < (min.priority ?? 99) ? t : min);
                        break;

                    case 'RR':
                        if (!currentTask && taskQueue.length > 0) {
                            bestTask = taskQueue.reduce((min, t) => t.lastQueuedAt < min.lastQueuedAt ? t : min);
                        } else {
                            bestTask = currentTask;
                        }
                        break;

                    default: // FCFS
                         if (!currentTask && taskQueue.length > 0) {
                            bestTask = taskQueue.sort((a,b) => a.createdAt - b.createdAt)[0];
                         }
                         else {
                            bestTask = currentTask; 
                         }
                }
            } else if (currentTask && currentTask.type !== 'Defense') {
                 bestTask = currentTask;
            }
        }
    }

    // --- Task Preemption & Execution Logic ---
    if (bestTask && bestTask !== currentTask) {
        let canPreempt = false;
        if (currentTask) {
             canPreempt = (bestTask.type === 'Defense') || 
                          (selectedAlgorithm === 'SRTF') ||
                          (selectedAlgorithm === 'PriorityP') ||
                          (selectedAlgorithm === 'RR'); 

             if (canPreempt && currentTask.type !== 'Defense') {
                currentTask.status = 'Waiting';
                if (currentTask.segments.length > 0) {
                    currentTask.segments[currentTask.segments.length - 1].end = gameTime;
                }
                currentTask.lastQueuedAt = gameTime;
                taskQueue.push(currentTask);
                addLogEntry(`PREEMPTED: ${currentTask.name || `P${currentTask.id}`} paused at ${gameTime}s.`);
                currentTask = null;
                currentTaskTimeSlice = 0;
            } else if (!canPreempt) {
                 bestTask = currentTask;
            }
        }
         if (!currentTask && bestTask) {
             const taskIndexInQueue = taskQueue.findIndex(t => t.id === bestTask.id);
             if (taskIndexInQueue > -1) {
                 currentTask = taskQueue.splice(taskIndexInQueue, 1)[0]; 
             } else {
                 currentTask = bestTask; 
             }

            currentTask.status = 'Running';
            if (!currentTask.segments.length || currentTask.segments[currentTask.segments.length - 1].end !== undefined) {
                 currentTask.segments.push({ start: gameTime });
            }
            currentTaskTimeSlice = 0;
            addLogEntry(`${(taskIndexInQueue > -1 || currentTask.segments.length > 1) ? 'STARTED' : 'RESUMED'}: ${currentTask.name || `P${currentTask.id}`} is now running at ${gameTime}s.`);
        }
    }

    // --- Task Execution ---
    if (currentTask) {
        currentTask.remainingTime--;
        currentTaskTimeSlice++; 

        if (currentTask.remainingTime <= 0) {
            completeTask(currentTask);
            currentTask = null;
            currentTaskTimeSlice = 0;
        }
    }

    updateUI();
    gameTime++;
}


function handleUpgradeClick(buildingId) {
    if (credits < UPGRADE_COST) { return addLogEntry('Not enough credits!'); }
    const building = buildings[buildingId];
     if (!building || building.isDamaged || building.isUnderAttack) {
         addLogEntry(`Cannot upgrade ${getBuildingName(building.code)} now.`);
         return;
     }
     if (taskQueue.some(t => t.buildingId === buildingId && t.type === 'Upgrade') || (currentTask && currentTask.buildingId === buildingId && currentTask.type === 'Upgrade')) {
         addLogEntry(`Upgrade for ${getBuildingName(building.code)} already in progress or queued.`);
         return;
     }

    credits -= UPGRADE_COST;
    const correspondingMission = missions.find(m => m.code === building.code && m.description.startsWith('Upgrade') && !m.completed);
    
    const burstTime = correspondingMission ? correspondingMission.burstTime : Math.floor(Math.random() * 6) + 5;
    const priority = correspondingMission ? correspondingMission.priority : 1;
    
    const task = {
        id: `P${taskIdCounter++}`, type: 'Upgrade', buildingId: buildingId,
        burstTime: burstTime, remainingTime: burstTime, status: 'Waiting',
        createdAt: gameTime, segments: [],
        name: `Upgrade ${getBuildingName(building.code)}`,
        priority: priority,
        lastQueuedAt: gameTime
    };
    taskQueue.push(task);
    addLogEntry(`QUEUED: ${task.id} (${task.name}, Burst: ${burstTime}s).`);
}

function completeTask(task) {
    task.completedAt = gameTime;
    if (task.segments.length > 0) {
        task.segments[task.segments.length - 1].end = Math.max(task.segments[task.segments.length - 1].start + 1, gameTime);
    }
    completedTasks.push(task);

    let missionCompleted = false;

    if(task.type === 'Upgrade') {
        credits += UPGRADE_REWARD;
        const building = buildings[task.buildingId];
        
        if(building) {
            building.level++;
            const completedMission = missions.find(m => m.code === building.code && m.description.startsWith('Upgrade') && !m.completed);
            
            if (completedMission) { 
                completedMission.completed = true; 
                missionCompleted = true; 
                addLogEntry(`Mission Complete: ${completedMission.description}`); 
            }
            addLogEntry(`COMPLETED: ${task.id} at ${gameTime}s. ${getBuildingName(building.code)} is now Lv. ${building.level}!`);
        } else {
             addLogEntry(`COMPLETED: ${task.id} (Upgrade) at ${gameTime}s.`);
        }

    } else if (task.type === 'Repair') {
         if(buildings[task.buildingId]) buildings[task.buildingId].isDamaged = false;
         const completedMission = missions.find(m => m.buildingId === task.buildingId && m.description.startsWith('Repair') && !m.completed);
         if (completedMission) { completedMission.completed = true; missionCompleted = true; addLogEntry(`Mission Complete: ${completedMission.description}`); }
        addLogEntry(`COMPLETED: ${task.id} (${task.name}) at ${gameTime}s.`);
    } else {
        addLogEntry(`COMPLETED: ${task.id} (${task.name}) at ${gameTime}s.`);
    }

    if (missionCompleted) updateMissionsUI();

    const originalMissions = missions.filter(m => m.id.toString().startsWith('mission_') && !m.description.startsWith('Repair'));
    if (originalMissions.length > 0 && originalMissions.every(m => m.completed)) {
        if (!document.querySelector('.popup-overlay')) {
             if(attackTimer) clearTimeout(attackTimer);
             attackTimer = null;
             showCompletionPopup();
        }
    }
}


// --- FINAL POPUP & REPORTING ---
function showCompletionPopup() {
    if (attackTimer) clearTimeout(attackTimer);
    attackTimer = null;

    if (completedTasks.length === 0) {
        addLogEntry("No tasks completed, cannot show report.");
        return;
    }

    const allCompletedTasksSorted = [...completedTasks].sort((a, b) => a.createdAt - b.createdAt);
    const { ganttHTML, tableHTML, legendHTML } = generateReportData(allCompletedTasksSorted);

    displayFinalPopup(ganttHTML, tableHTML, legendHTML);
}

function displayFinalPopup(ganttHTML, tableHTML, legendHTML) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const scoreHTML = `<h2>All Missions Complete!</h2><p>Well done, Chief! The village upgrades are finished.</p><hr style="margin: 20px 0;">`;

    overlay.innerHTML = `
        <div class="popup-content">
            ${scoreHTML}
            <h3>Execution Gantt Chart</h3>
            ${ganttHTML}
            <div class="gantt-legend">${legendHTML}</div>
            <h3 style="margin-top: 20px;">Performance Details</h3>
            ${tableHTML}
            <p style="margin-top: 15px; font-style: italic; background-color: #fdf5e6; padding: 10px; border-radius: 5px;"><b>Pro Tip:</b> ${getProTip()}</p>
            <button id="popup-close-btn">Close</button>
        </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#popup-close-btn').onclick = () => {
        document.body.removeChild(overlay);
    };
}


function generateReportData(allTasks) {
    const processData = {}, timeline = [], legendData = [];
    const GANTT_COLORS = ['#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#e74c3c', '#34495e', '#95a5a6'];

    allTasks.forEach((task, index) => {
        const turnaround = task.completedAt - task.createdAt;
        const waiting = turnaround - task.burstTime;
        processData[task.id] = { arrival: task.createdAt, burst: task.burstTime, turnaround, waiting: waiting < 0 ? 0 : waiting };
        task.segments.forEach(seg => {
             if (seg.end !== undefined && seg.start !== undefined && seg.end > seg.start) {
                timeline.push({ pid: task.id, start: seg.start, end: seg.end });
            } else if (seg.start !== undefined && task.completedAt !== undefined && task.completedAt >= seg.start) {
                 const endTime = Math.max(seg.start + 1, task.completedAt);
                 timeline.push({ pid: task.id, start: seg.start, end: endTime });
            }
        });
        let taskName = task.name || `Task ${task.id}`;
        if (task.type === 'Upgrade' && buildings[task.buildingId]) {
            taskName = `Upgrade ${getBuildingName(buildings[task.buildingId].code)}`;
        } else if (task.type === 'Repair' && buildings[task.buildingId]) {
             taskName = `Repair ${getBuildingName(buildings[task.buildingId].code)}`;
        }
        legendData.push({ id: task.id, name: taskName, color: GANTT_COLORS[index % GANTT_COLORS.length] });
    });

    const maxCompletionTime = allTasks.length > 0 ? Math.max(...allTasks.map(t => t.completedAt)) : 0;
    const maxTime = Math.max(gameTime, maxCompletionTime, 1);

    const ganttHTML = createGANTTSVG(allTasks, timeline, maxTime, GANTT_COLORS);
    const tableHTML = createMetricsTable(allTasks, processData);
    const legendHTML = legendData.map(item => `<div class="legend-item"><div class="legend-color-box" style="background-color: ${item.color};"></div>${item.id}: ${item.name}</div>`).join('');

    return { ganttHTML, tableHTML, legendHTML };
}

function createGANTTSVG(allTasks, timeline, maxTime, colors) {
    const PADDING = { top: 20, right: 20, bottom: 40, left: 80 }; 
    const ROW_HEIGHT = 30;
    const ROW_GAP = 10;
    const totalChartHeight = (ROW_HEIGHT + ROW_GAP) * allTasks.length + PADDING.top + PADDING.bottom;
    const ganttWidth = Math.max(750, maxTime * 40);
    const timeScale = (ganttWidth - PADDING.left - PADDING.right) / (maxTime > 0 ? maxTime : 1);
    let svgContent = '';

    allTasks.forEach((task, index) => {
        const y = PADDING.top + index * (ROW_HEIGHT + ROW_GAP);
        svgContent += `<text x="${PADDING.left - 10}" y="${y + ROW_HEIGHT / 2}" class="gantt-row-label" dominant-baseline="middle" text-anchor="end">${task.id}</text>`;
        timeline.filter(s => s.pid === task.id).forEach(segment => {
            const rectX = PADDING.left + segment.start * timeScale;
            const rectWidth = Math.max(0, (segment.end - segment.start) * timeScale);
            if (rectWidth > 0.1) {
                 svgContent += `<rect x="${rectX}" y="${y}" width="${rectWidth}" height="${ROW_HEIGHT}" fill="${colors[index % colors.length]}" class="gantt-segment"><title>Process: ${task.id}\nStart: ${segment.start}s\nEnd: ${segment.end}s</title></rect>`;
            }
        });
    });

    const axisY = PADDING.top + allTasks.length * (ROW_HEIGHT + ROW_GAP);
    svgContent += `<line x1="${PADDING.left}" y1="${axisY}" x2="${ganttWidth - PADDING.right}" y2="${axisY}" class="gantt-axis-line"></line>`;
    const tickInterval = maxTime > 30 ? 5 : (maxTime > 10 ? 2 : 1);
    for (let t = 0; t <= maxTime; t += tickInterval) {
        const tickX = PADDING.left + t * timeScale;
         svgContent += `<line x1="${tickX}" y1="${axisY}" x2="${tickX}" y2="${axisY - 5}" class="gantt-axis-line"></line>`;
        svgContent += `<text x="${tickX}" y="${axisY + 15}" class="gantt-axis-tick-label" text-anchor="middle">${t}</text>`;
    }
    return `<div class="gantt-chart-container"><svg class="gantt-svg" width="${ganttWidth}" height="${totalChartHeight}">${svgContent}</svg></div>`;
}

function createMetricsTable(allTasks, processData) {
    let tableHTML = `<div class="metrics-table-container"><table class="metrics-table"><thead><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Turnaround</th><th>Waiting</th></tr></thead><tbody>`;
    allTasks.forEach(task => {
        const pid = task.id;
        const data = processData[pid] || { arrival: task.createdAt, burst: task.burstTime, turnaround: task.completedAt - task.createdAt, waiting: Math.max(0, task.completedAt - task.createdAt - task.burstTime) };
        let taskName = task.name || `Task ${task.id}`;
        if (task.type === 'Upgrade' && buildings[task.buildingId]) {
            taskName = `Upgrade ${getBuildingName(buildings[task.buildingId].code)}`;
        } else if (task.type === 'Repair' && buildings[task.buildingId]) {
             taskName = `Repair ${getBuildingName(buildings[task.buildingId].code)}`;
        }

        tableHTML += `<tr><td>${pid}: ${taskName}</td><td>${data.arrival}s</td><td>${data.burst}s</td><td>${data.turnaround}s</td><td>${data.waiting}s</td></tr>`;
    });
    return tableHTML + `</tbody></table></div>`;
}


function getProTip() {
    switch(selectedAlgorithm) {
        case 'FCFS': return "FCFS is simple but can lead to long waits if short tasks get stuck behind long ones (Convoy Effect).";
        case 'SJF': return "SJF (non-preemptive) minimizes average waiting time but requires knowing burst times and can starve long tasks.";
        case 'SRTF': return "SRTF (preemptive) is optimal for average wait time, but can 'starve' long tasks if new short tasks keep arriving.";
        case 'PriorityNP': return "Priority (non-preemptive) ensures high-priority tasks (like Repairs) run first, but can 'starve' low-priority tasks.";
        case 'PriorityP': return "Priority (preemptive) will interrupt tasks to run higher-priority ones (like Repairs) immediately. Can also 'starve' low-priority tasks.";
        case 'RR': return "Round Robin is 'fair' and gives every task a turn. A small Time Quantum causes lots of context switches, while a large one acts like FCFS.";
        default: return "Choosing the right algorithm depends on the goals!";
    }
}

// --- OTHER HELPER FUNCTIONS ---
function generateMissions(min, max) {
    missions = [];
    const upgradeableBuildings = Object.values(buildings).filter(b => UPGRADEABLE_DEFENSES.includes(b.code) && !b.isDamaged);
    
    const uniqueUpgradeableCodes = [...new Set(upgradeableBuildings.map(b => b.code))];

    const missionsToGenerate = Math.min(uniqueUpgradeableCodes.length, Math.floor(Math.random() * (max - min + 1)) + min);
    
    if (missionsToGenerate === 0) {
        addLogEntry("No available building types for new upgrade missions.");
        return;
    }

    const shuffledCodes = uniqueUpgradeableCodes.sort(() => 0.5 - Math.random());
    const selectedCodes = shuffledCodes.slice(0, missionsToGenerate);

    let priorityList = [];
    for (let i = 0; i < selectedCodes.length; i++) {
        priorityList.push(i + 1); 
    }
    priorityList = shuffleArray(priorityList);

    selectedCodes.forEach((code, index) => {
        const buildingName = getBuildingName(code);
        missions.push({
            id: `mission_${index + 1}`,
            code: code,
            buildingId: null,
            description: `Upgrade a ${buildingName}`,
            burstTime: Math.floor(Math.random() * 6) + 5,
            completed: false,
            priority: priorityList[index] 
        });
    });
    
    updateMissionsUI();
    addLogEntry(`${missionsToGenerate} new upgrade missions generated!`);
}

function updateUI() {
    creditsDisplay.textContent = `${credits} 💰`;
    document.getElementById('builders-display').textContent = `1 👷`;
    updateQueueUI();
    updateMissionsUI();
    updateBuildingIcons();
}

function updateQueueUI() {
    taskQueueContainer.innerHTML = '';
    
    let tasksToDisplay = [...taskQueue];
    
    const isPriority = selectedAlgorithm === 'PriorityNP' || selectedAlgorithm === 'PriorityP';
    const isFIFO = selectedAlgorithm === 'FCFS' || selectedAlgorithm === 'RR';

    if (isPriority) {
        tasksToDisplay.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    } else if (selectedAlgorithm === 'SJF') {
        tasksToDisplay.sort((a, b) => a.burstTime - b.burstTime);
    } else if (selectedAlgorithm === 'SRTF') {
        tasksToDisplay.sort((a, b) => a.remainingTime - b.remainingTime);
    } else if (isFIFO) {
        tasksToDisplay.sort((a, b) => (a.lastQueuedAt ?? a.createdAt) - (b.lastQueuedAt ?? b.createdAt));
    }
    
    const allTasks = [...(currentTask ? [currentTask] : []), ...tasksToDisplay];

    if (allTasks.length === 0) {
        taskQueueContainer.innerHTML = '<p>Queue is empty.</p>';
        return;
    }
    allTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.classList.add('task-item');
        if (task === currentTask) {
             taskEl.classList.add('running');
             task.status = 'Running';
        } else {
             task.status = 'Waiting';
        }
        const taskName = task.name || `Task ${task.id}`;
        
        const priorityText = (isPriority && task.priority !== undefined) ? ` (Prio: ${task.priority})` : '';
        
        taskEl.innerHTML = `<strong>${task.id}</strong>: ${taskName}${priorityText}<br>Rem: ${task.remainingTime}s / Burst: ${task.burstTime}s<br>Status: ${task.status}`;
        taskQueueContainer.appendChild(taskEl);
    });
}

function addLogEntry(message) {
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    activityLogContainer.prepend(logEntry);
     if (activityLogContainer.children.length > 50) {
         activityLogContainer.removeChild(activityLogContainer.lastChild);
     }
}

function updateMissionsUI() {
    missionsList.innerHTML = '';
    let activeMissions = missions.filter(m => !m.completed || m.description.startsWith('Repair')); 

    if (activeMissions.length === 0) {
        const originalMissions = missions.filter(m => m.id.toString().startsWith('mission_') && !m.description.startsWith('Repair'));
        if (originalMissions.length > 0 && originalMissions.every(m => m.completed)) {
            missionsList.innerHTML = '<li>All upgrade missions complete!</li>';
        } else {
            missionsList.innerHTML = '<li>Select a difficulty to start.</li>';
        }
        return;
    }

    if (selectedAlgorithm === 'PriorityNP' || selectedAlgorithm === 'PriorityP') {
        activeMissions.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    }

    activeMissions.forEach(mission => {
        const li = document.createElement('li');
        
        const isPriority = selectedAlgorithm === 'PriorityNP' || selectedAlgorithm === 'PriorityP';
        const priorityText = (isPriority && mission.priority !== undefined) ? ` (Prio: ${mission.priority})` : '';
        const burstText = mission.burstTime ? ` (Burst: ${mission.burstTime}s)` : '';

        li.textContent = mission.description + priorityText + burstText;
        
        if (mission.completed) li.classList.add('completed');
        missionsList.appendChild(li);
    });
}


function getBuildingName(code) {
    const buildingName = Object.keys(BUILDING_CODES).find(key => BUILDING_CODES[key] === code) || 'Unknown';
    return buildingName.replace(/_/g, ' ');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- START THE GAME ---
initGame();
}
