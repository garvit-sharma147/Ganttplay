// --- CONSTANTS AND GAME STATE ---
const BUILDING_CODES = {
    GRASS: 0, TOWNHALL: 1, CANNON: 2, ARCHER_TOWER: 3,
    WIZARD_TOWER: 4, MONOLITH: 5, CREDIT_STORAGE: 6, BUILDER_HOUSE: 7,
};
const UPGRADE_COST = 50;
const UPGRADE_REWARD = 100;

let credits = 200;
let builders = 1;
let isBuilderBusy = false;
let taskQueue = [];
let completedTasks = []; // For metrics at the end
let buildings = {};
let missions = [];
let taskIdCounter = 1;

// --- DOM ELEMENTS ---
const gridContainer = document.getElementById('grid-container');
const creditsDisplay = document.getElementById('credits-display');
const buildersDisplay = document.getElementById('builders-display');
const taskQueueContainer = document.getElementById('task-queue');
const activityLogContainer = document.getElementById('activity-log');
const missionsList = document.getElementById('missions-list');
const editLayoutBtn = document.getElementById('edit-layout-btn');
const btnEasy = document.getElementById('btn-easy');
const btnMedium = document.getElementById('btn-medium');
const btnHard = document.getElementById('btn-hard');


// --- INITIALIZATION ---
function initGame() {
    PRESET_BUILDINGS.forEach(b => {
        const buildingId = `${getBuildingName(b.code).replace(' ', '_')}_${b.x}_${b.y}`;
        buildings[buildingId] = { ...b, id: buildingId };
    });
    renderGrid();
    updateUI();
    
    editLayoutBtn.addEventListener('click', () => {
        addLogEntry('Feature coming soon: Edit Base Layout!');
        alert('Edit Base Layout feature coming soon!');
    });
    
    btnEasy.addEventListener('click', () => {
        generateMissions(4, 6);
        btnEasy.disabled = true; btnMedium.disabled = true; btnHard.disabled = true;
    });
    btnMedium.addEventListener('click', () => alert('Medium difficulty coming soon!'));
    btnHard.addEventListener('click', () => alert('Hard difficulty coming soon!'));
    
    setInterval(processQueue, 1000);
}

function renderGrid() {
    gridContainer.innerHTML = '';
    Object.values(buildings).forEach(buildingData => {
        const buildingEl = document.createElement('div');
        buildingEl.className = 'building';
        buildingEl.dataset.buildingId = buildingData.id;
        const colStart = buildingData.x + 1;
        const rowStart = buildingData.y + 1;
        buildingEl.style.gridColumn = `${colStart} / span 3`;
        buildingEl.style.gridRow = `${rowStart} / span 3`;
        const img = document.createElement('img');
        img.src = buildingData.img;
        img.alt = getBuildingName(buildingData.code);
        buildingEl.appendChild(img);
        const badge = document.createElement('div');
        badge.className = 'level-badge';
        badge.textContent = `Lv. ${buildingData.level}`;
        buildingEl.appendChild(badge);
        if ([2, 3, 4, 5].includes(buildingData.code)) {
            const tip = document.createElement('div');
            tip.className = 'upgrade-tooltip';
            tip.innerHTML = `<div>⚒️ Upgrade Now</div><button class="btn-upgrade">Cost: ${UPGRADE_COST}💰</button>`;
            buildingEl.appendChild(tip);
            tip.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                handleUpgradeClick(buildingData.id);
            });
        }
        gridContainer.appendChild(buildingEl);
    });
}


function generateMissions(min, max) {
    missions = [];
    const defenseBuildings = Object.values(buildings).filter(b => b.code >= 2 && b.code <= 5);
    const missionsToGenerate = Math.floor(Math.random() * (max - min + 1)) + min;
    for (let i = 0; i < missionsToGenerate && i < defenseBuildings.length; i++) {
        const building = defenseBuildings[i];
        missions.push({
            id: `mission_${i+1}`,
            buildingId: building.id,
            description: `Upgrade ${getBuildingName(building.code)} to Level ${building.level + 1}`,
            completed: false
        });
    }
    updateMissionsUI();
    addLogEntry(`${missions.length} new missions generated!`);
}

// --- GAME LOGIC ---
function handleUpgradeClick(buildingId) {
    if (credits < UPGRADE_COST) {
        addLogEntry('Not enough credits to upgrade!');
        return;
    }
    credits -= UPGRADE_COST;
    const burstTime = Math.floor(Math.random() * 6) + 5;
    const task = {
        id: taskIdCounter++, type: 'Upgrade', buildingId: buildingId,
        burstTime: burstTime, remainingTime: burstTime, status: 'Waiting',
        createdAt: Date.now() // For metrics
    };
    taskQueue.push(task);
    addLogEntry(`Queued P${task.id}: Upgrade ${getBuildingName(buildings[buildingId].code)}.`);
    updateUI();
}

async function processQueue() {
    if (isBuilderBusy || taskQueue.length === 0) return;

    isBuilderBusy = true;
    const task = taskQueue[0];
    task.status = 'Running';
    task.startedAt = Date.now(); // For metrics
    addLogEntry(`Started P${task.id}: Upgrading ${getBuildingName(buildings[task.buildingId].code)}.`);
    updateUI();

    const buildingEl = document.querySelector(`.building[data-building-id='${task.buildingId}']`);
    const hammer = document.createElement('div');
    if (buildingEl) {
        hammer.className = 'hammer-emoji';
        hammer.textContent = '🔨';
        buildingEl.appendChild(hammer);
    }
    
    await new Promise(res => setTimeout(res, task.burstTime * 1000));
    
    completeTask(task, buildingEl, hammer);
}

function completeTask(task, buildingEl, hammer) {
    task.completedAt = Date.now(); // For metrics
    taskQueue.shift();
    completedTasks.push(task);
    
    credits += UPGRADE_REWARD;
    buildings[task.buildingId].level++;
    addLogEntry(`Completed P${task.id}: ${getBuildingName(buildings[task.buildingId].code)} is now Lv. ${buildings[task.buildingId].level}! +100 credits.`);
    
    const completedMission = missions.find(m => m.buildingId === task.buildingId && !m.completed);
    if (completedMission) {
        completedMission.completed = true;
        addLogEntry(`Mission Complete: ${completedMission.description}`);
    }

    if (buildingEl) {
        hammer.remove();
        const badge = buildingEl.querySelector('.level-badge');
        if (badge) badge.textContent = `Lv. ${buildings[task.buildingId].level}`;
        buildingEl.animate([{ transform: 'scale(1.05)', filter: 'brightness(1.5)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 400, easing: 'ease-out' });
    }

    isBuilderBusy = false;
    updateUI();

    if (missions.length > 0 && missions.every(m => m.completed)) {
        showCompletionPopup();
    }
}

// --- UI UPDATES ---
function updateUI() {
    creditsDisplay.textContent = `${credits} 💰`;
    updateQueueUI();
    updateMissionsUI();
}

function updateQueueUI() {
    taskQueueContainer.innerHTML = taskQueue.length === 0 ? '<p>Queue is empty.</p>' : '';
    taskQueue.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.classList.add('task-item');
        if (task.status === 'Running') taskEl.classList.add('running');
        taskEl.innerHTML = `
            <strong>P${task.id}: ${task.type} ${getBuildingName(buildings[task.buildingId].code)}</strong><br>
            Status: ${task.status} (${task.status === 'Running' ? task.remainingTime + 's left' : ''})
        `;
        taskQueueContainer.appendChild(taskEl);
    });
}

function addLogEntry(message) {
    const logEntry = document.createElement('p');
    logEntry.classList.add('log-entry');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    activityLogContainer.prepend(logEntry);
}

function updateMissionsUI() {
    missionsList.innerHTML = '';
    if (missions.length === 0) {
        missionsList.innerHTML = '<li>Select a difficulty to start.</li>';
        return;
    }
    missions.forEach(mission => {
        const li = document.createElement('li');
        li.textContent = mission.description;
        if (mission.completed) li.classList.add('completed');
        missionsList.appendChild(li);
    });
}

// ✅ POPUP FUNCTION NOW INCLUDES THE METRICS TABLE
function showCompletionPopup() {
    let totalWaitTime = 0;
    let totalTurnaroundTime = 0;
    completedTasks.forEach(task => {
        totalWaitTime += (task.startedAt - task.createdAt);
        totalTurnaroundTime += (task.completedAt - task.createdAt);
    });
    const avgWaitTime = (totalWaitTime / completedTasks.length / 1000).toFixed(2);
    const avgTurnaroundTime = (totalTurnaroundTime / completedTasks.length / 1000).toFixed(2);

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const popup = document.createElement('div');
    popup.className = 'popup-content';
    
    let ganttHTML = '';
    const firstTaskTime = completedTasks[0].createdAt;
    const lastTaskTime = completedTasks[completedTasks.length - 1].completedAt;
    const totalDuration = Math.max(1, lastTaskTime - firstTaskTime);

    completedTasks.forEach((task, index) => {
        const waitDuration = task.startedAt - task.createdAt;
        const runDuration = task.completedAt - task.startedAt;
        const waitPercent = (waitDuration / totalDuration) * 100;
        const runPercent = (runDuration / totalDuration) * 100;
        const offset = ((task.createdAt - firstTaskTime) / totalDuration) * 100;
        ganttHTML += `<div class="gantt-row"><div class="gantt-label">P${task.id}</div><div class="gantt-bar-container"><div class="gantt-bar" style="--offset: ${offset}%; --wait: ${waitPercent}%; --run: ${runPercent}%; animation-delay: ${index * 100}ms;"><div class="gantt-wait"></div><div class="gantt-run"></div></div></div></div>`;
    });

    // ✅ NEW: Create the metrics table HTML
    let tableHTML = `<div class="metrics-table-container"><table class="metrics-table"><thead><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Waiting</th><th>Turnaround</th><th>Response</th></tr></thead><tbody>`;
    completedTasks.forEach(task => {
        const arrivalTime = ((task.createdAt - firstTaskTime) / 1000).toFixed(2);
        const burstTime = task.burstTime.toFixed(2);
        const waitingTime = ((task.startedAt - task.createdAt) / 1000).toFixed(2);
        const turnaroundTime = ((task.completedAt - task.createdAt) / 1000).toFixed(2);
        const processName = getBuildingName(buildings[task.buildingId].code).split(' ')[0] + ' Up';
        tableHTML += `<tr><td>P${task.id}: ${processName}</td><td>${arrivalTime}s</td><td>${burstTime}s</td><td>${waitingTime}s</td><td>${turnaroundTime}s</td><td>${waitingTime}s</td></tr>`;
    });
    tableHTML += `</tbody></table></div>`;

    popup.innerHTML = `
        <h2>Great job, Chief!</h2>
        <p>All missions for today are complete. Here's the performance breakdown:</p>
        <div class="metrics"><div>Avg. Waiting Time: <strong>${avgWaitTime}s</strong></div><div>Avg. Turnaround Time: <strong>${avgTurnaroundTime}s</strong></div></div>
        <h3>Execution Gantt Chart</h3>
        <div class="gantt-chart">${ganttHTML}</div>
        <h3 style="margin-top: 20px;">Performance Details</h3>
        ${tableHTML}
        <button id="popup-close-btn">Close</button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById('popup-close-btn').addEventListener('click', () => {
        overlay.remove();
    });
}


// --- HELPERS ---
function getBuildingName(code) {
    const buildingName = Object.keys(BUILDING_CODES).find(key => BUILDING_CODES[key] === code) || 'Unknown';
    return buildingName.replace('_', ' ');
}

// --- START THE GAME ---
initGame();