// app.js

// State
let currentDate = new Date();
let selectedDate = null;
let schedules = JSON.parse(localStorage.getItem('ag_schedules_v2')) || [];
let publicHolidays = {};
let editingScheduleId = null;

async function fetchHolidays() {
    try {
        const res = await fetch('https://holidays-jp.github.io/api/v1/date.json');
        if (res.ok) {
            publicHolidays = await res.json();
            renderCalendar();
            if (selectedDate) updateScheduleView();
        }
    } catch (e) {
        console.error('Failed to fetch holidays', e);
    }
}

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearDisplay = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

const selectedDateDisplay = document.getElementById('selected-date-display');
const scheduleList = document.getElementById('schedule-list');
const openModalBtn = document.getElementById('open-modal-btn');

const modalOverlay = document.getElementById('schedule-modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');

// Form Elements
const titleInput = document.getElementById('schedule-title');
const startDateInput = document.getElementById('schedule-start-date');
const endDateInput = document.getElementById('schedule-end-date');
const timeInput = document.getElementById('schedule-time');
const remindInput = document.getElementById('schedule-remind');
const todoInput = document.getElementById('schedule-todo');
const generateAiBtn = document.getElementById('generate-ai-plan-btn');
const aiPlanOutput = document.getElementById('ai-plan-output');

let fpStart, fpEnd;

// Initialize
function init() {
    renderCalendar();
    attachEventListeners();
    fetchHolidays();
    
    // Initialize Flatpickr
    fpStart = flatpickr("#schedule-start-date", {
        locale: "ja",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr) {
            if (fpEnd) fpEnd.set('minDate', dateStr);
        }
    });
    
    fpEnd = flatpickr("#schedule-end-date", {
        locale: "ja",
        dateFormat: "Y-m-d"
    });
}

// Calendar Logic
function renderCalendar() {
    calendarGrid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    currentMonthYearDisplay.textContent = `${year}年 ${month + 1}月`;
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayDate = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Previous month empty cells
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day', 'empty');
        calendarGrid.appendChild(emptyCell);
    }
    
    // Days of current month
    for (let i = 1; i <= lastDayDate; i++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = i;
        
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cellDateObj = new Date(year, month, i);
        dayCell.dataset.date = cellDateStr;
        
        let dayContent = `<span>${i}</span>`;
        
        const dayOfWeek = cellDateObj.getDay();
        if (dayOfWeek === 0) dayCell.classList.add('sunday');
        if (dayOfWeek === 6) dayCell.classList.add('saturday');
        
        if (publicHolidays[cellDateStr]) {
            dayCell.classList.add('holiday');
            dayCell.title = publicHolidays[cellDateStr];
        }
        
        dayCell.innerHTML = dayContent;
        
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayCell.classList.add('today');
        }
        
        if (selectedDate === cellDateStr) {
            dayCell.classList.add('selected');
        }
        
        const hasSchedule = schedules.some(s => {
            const start = new Date(s.startDate);
            const end = new Date(s.endDate);
            return cellDateObj >= start && cellDateObj <= end;
        });
        
        if (hasSchedule) {
            dayCell.classList.add('has-schedule');
        }
        
        dayCell.addEventListener('click', () => selectDate(cellDateStr));
        calendarGrid.appendChild(dayCell);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    updateScheduleView();
    openModalBtn.disabled = false;
}

function showMonthlySchedules() {
    selectedDate = null;
    renderCalendar();
    updateScheduleView();
    openModalBtn.disabled = true;
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
    if (!selectedDate) {
        updateScheduleView();
    }
}

// Schedule Logic
function updateScheduleView() {
    let displaySchedules = [];
    
    if (selectedDate) {
        const [year, month, day] = selectedDate.split('-');
        let headerText = `${year}年 ${parseInt(month)}月 ${parseInt(day)}日の予定`;
        if (publicHolidays[selectedDate]) {
            headerText += ` <span style="font-size: 0.9rem; color: var(--danger);">(${publicHolidays[selectedDate]})</span>`;
        }
        selectedDateDisplay.innerHTML = headerText;
        
        const selObj = new Date(year, parseInt(month) - 1, day);
        
        displaySchedules = schedules.filter(s => {
            const start = new Date(s.startDate);
            const end = new Date(s.endDate);
            return selObj >= start && selObj <= end;
        });
    } else {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        selectedDateDisplay.textContent = `${year}年 ${month + 1}月のすべての予定`;
        
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        
        displaySchedules = schedules.filter(s => {
            const start = new Date(s.startDate);
            const end = new Date(s.endDate);
            return start <= monthEnd && end >= monthStart;
        });
    }
    
    scheduleList.innerHTML = '';
    
    if (displaySchedules.length === 0) {
        scheduleList.innerHTML = `
            <li class="empty-state">
                <i class="ph ph-calendar-blank"></i>
                <p>予定がありません</p>
            </li>
        `;
        return;
    }
    
    displaySchedules.sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return a.time.localeCompare(b.time);
    });
    
    displaySchedules.forEach(schedule => {
        const li = document.createElement('li');
        li.classList.add('schedule-item');
        
        let aiPlanHtml = '';
        if (schedule.aiPlan) {
            aiPlanHtml = `<div class="schedule-ai-plan"><strong>AIアクションプラン:</strong><br>${schedule.aiPlan.replace(/\n/g, '<br>')}</div>`;
        }
        
        const dateRangeStr = schedule.startDate === schedule.endDate 
            ? schedule.startDate 
            : `${schedule.startDate} 〜 ${schedule.endDate}`;
        
        li.innerHTML = `
            <div class="schedule-item-header">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);"><i class="ph ph-calendar"></i> ${dateRangeStr}</div>
                    <div class="schedule-time"><i class="ph ph-clock"></i> ${schedule.time || '終日'} &nbsp;&nbsp; <i class="ph ph-bell"></i> ${getRemindLabel(schedule.remind)}</div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="edit-btn" onclick="editSchedule('${schedule.id}')" title="編集">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteSchedule('${schedule.id}')" title="削除">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
            <div class="schedule-title">${schedule.title}</div>
            ${schedule.todo ? `<div class="schedule-todo"><i class="ph ph-check-square"></i> ${schedule.todo}</div>` : ''}
            ${aiPlanHtml}
        `;
        scheduleList.appendChild(li);
    });
}

function getRemindLabel(val) {
    const map = { 'none': 'なし', '10m': '10分前', '30m': '30分前', '1h': '1時間前' };
    return map[val] || 'なし';
}

function saveSchedule() {
    if (!titleInput.value.trim() || !startDateInput.value || !endDateInput.value) {
        alert('タイトル、開始日、終了日は必須です。');
        return;
    }
    if (new Date(startDateInput.value) > new Date(endDateInput.value)) {
        alert('終了日は開始日以降の日付にしてください。');
        return;
    }
    
    const scheduleData = {
        id: editingScheduleId || Date.now().toString(),
        title: titleInput.value.trim(),
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        time: timeInput.value,
        remind: remindInput.value,
        todo: todoInput.value.trim(),
        aiPlan: aiPlanOutput.dataset.plan || null
    };
    
    if (editingScheduleId) {
        const index = schedules.findIndex(s => s.id === editingScheduleId);
        if (index > -1) schedules[index] = scheduleData;
    } else {
        schedules.push(scheduleData);
    }
    
    localStorage.setItem('ag_schedules_v2', JSON.stringify(schedules));
    
    closeModal();
    renderCalendar(); 
    updateScheduleView();
}

window.deleteSchedule = function(id) {
    if (confirm('この予定を削除しますか？')) {
        schedules = schedules.filter(s => s.id !== id);
        localStorage.setItem('ag_schedules_v2', JSON.stringify(schedules));
        renderCalendar();
        updateScheduleView();
    }
};

window.editSchedule = function(id) {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;
    
    editingScheduleId = id;
    modalTitle.textContent = '予定の編集';
    
    titleInput.value = schedule.title;
    if (fpStart && fpEnd) {
        fpStart.setDate(schedule.startDate);
        fpEnd.setDate(schedule.endDate);
        fpEnd.set('minDate', schedule.startDate);
    }
    timeInput.value = schedule.time || '';
    remindInput.value = schedule.remind || 'none';
    todoInput.value = schedule.todo || '';
    
    if (schedule.aiPlan) {
        aiPlanOutput.innerHTML = schedule.aiPlan.replace(/\n/g, '<br>');
        aiPlanOutput.dataset.plan = schedule.aiPlan;
        aiPlanOutput.classList.remove('hidden');
    } else {
        aiPlanOutput.innerHTML = '';
        aiPlanOutput.dataset.plan = '';
        aiPlanOutput.classList.add('hidden');
    }
    
    modalOverlay.classList.remove('hidden');
};

// Modal Logic
function openModal() {
    editingScheduleId = null;
    modalTitle.textContent = '新規予定の登録';
    
    titleInput.value = '';
    
    const defaultDate = selectedDate || new Date().toISOString().split('T')[0];
    if (fpStart && fpEnd) {
        fpStart.setDate(defaultDate);
        fpEnd.setDate(defaultDate);
        fpEnd.set('minDate', defaultDate);
    }
    
    timeInput.value = '';
    remindInput.value = 'none';
    todoInput.value = '';
    aiPlanOutput.innerHTML = '';
    aiPlanOutput.classList.add('hidden');
    aiPlanOutput.dataset.plan = '';
    
    modalOverlay.classList.remove('hidden');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    editingScheduleId = null;
}

// AI Logic (Gemini API Integration)
async function generateAiPlan() {
    const todoText = todoInput.value.trim();
    if (!todoText) {
        alert('やること（タスク）を入力してください。AIがそれを基にプランを作成します。');
        return;
    }
    
    // Show loading
    aiPlanOutput.innerHTML = '<div class="ai-loading"><i class="ph ph-spinner spinner"></i> AIがアクションプランを生成中...</div>';
    aiPlanOutput.classList.remove('hidden');
    generateAiBtn.disabled = true;

    try {
        // PHPサーバー (localhost:8000) に明示的にリクエストを送る
        const response = await fetch('http://localhost:8000/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ todoText: todoText })
        });
        
        if (!response.ok) {
            // 利用制限などでエラーになった場合
            if (response.status === 429) {
                throw new Error('本日のAI利用制限（無料枠）に達しました。明日またお試しください。');
            }
            throw new Error(`サーバー通信エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        aiPlanOutput.innerHTML = aiResponse.replace(/\n/g, '<br>');
        aiPlanOutput.dataset.plan = aiResponse;
    } catch (error) {
        console.error('API error:', error);
        aiPlanOutput.innerHTML = `<div style="color: var(--danger);"><i class="ph ph-warning-circle"></i> エラーが発生しました。<br>${error.message}</div>`;
    } finally {
        generateAiBtn.disabled = false;
    }
}

// Event Listeners
function attachEventListeners() {
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    currentMonthYearDisplay.addEventListener('click', showMonthlySchedules);
    
    openModalBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveSchedule);
    
    generateAiBtn.addEventListener('click', generateAiPlan);
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// Start
init();
