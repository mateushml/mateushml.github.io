document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO DO FIREBASE ---
    const db = firebase.firestore();
    let unsubscribeFromData;

    // --- ELEMENTOS DO DOM ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const todayBtn = document.getElementById('today-btn');
    const reportGrid = document.getElementById('report-grid');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const modal = document.getElementById('entry-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const deleteEntryBtn = document.getElementById('delete-entry-btn');
    const holidayDateInput = document.getElementById('holiday-date');
    const addHolidayBtn = document.getElementById('add-holiday-btn');
    const holidaysList = document.getElementById('holidays-list');
    const calculateExitBtn = document.getElementById('calculate-exit-btn');
    const exitResultEl = document.getElementById('exit-result');

    // --- ESTADO E CONSTANTES ---
    const WORKDAY_MINUTES = 8 * 60;
    const BALANCE_LIMIT_MINUTES = 90;
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let currentMonthData = { holidays: [], records: {} };
    let currentDayToEdit = null;

    // --- FUNÇÕES AUXILIARES DE TEMPO ---
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };
    const formatMinutes = (totalMinutes, withSign = true) => {
        if (isNaN(totalMinutes)) return "-";
        const sign = totalMinutes < 0 ? '−' : '+';
        const absMinutes = Math.abs(Math.round(totalMinutes));
        const hours = Math.floor(absMinutes / 60);
        const minutes = absMinutes % 60;
        return `${withSign ? sign : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };
    const minutesToTime = (totalMinutes) => {
        if (totalMinutes < 0) totalMinutes = 0;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = Math.round(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    // --- FUNÇÕES DE DADOS (FIREBASE) ---
    const listenToMonthData = () => {
        if (unsubscribeFromData) {
            unsubscribeFromData();
        }
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        unsubscribeFromData = db.collection('pontoData').doc(docId).onSnapshot(doc => {
            currentMonthData = doc.exists ? doc.data() : { holidays: [], records: {} };
            if (!currentMonthData.holidays) currentMonthData.holidays = [];
            if (!currentMonthData.records) currentMonthData.records = {};
            updateUI(year, month);
        }, error => {
            console.error("Erro ao ouvir os dados do Firebase:", error);
            alert("Não foi possível carregar os dados. Verifique sua conexão e a configuração do Firebase.");
        });
    };

    // --- FUNÇÕES DE UI E CÁLCULO ---
    const updateUI = (year, month) => {
        generateCalendar(year, month);
        generateReport(year, month);
    };

    const generateCalendar = (year, month) => {
        calendarGrid.innerHTML = '';
        const date = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            date.setDate(day);
            const dayOfWeek = date.getDay();
            const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const card = document.createElement('div');
            card.className = 'day-card';
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = (currentMonthData.holidays || []).includes(dayString);
            let dayBalance = '-';
            let dayTimes = 'Nenhum registro';
            const record = currentMonthData.records ? currentMonthData.records[day] : null;

            if (record && record.times && record.times.every(t => t)) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                const balance = totalWork - WORKDAY_MINUTES;
                dayBalance = formatMinutes(balance);
                dayTimes = `${record.times[0]}-${record.times[1]} / ${record.times[2]}-${record.times[3]}`;
            }

            card.innerHTML = `<div class="day-info">${day} <span>${date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span></div><div class="day-times">${dayTimes}</div><div class="day-balance" style="color: ${dayBalance.startsWith('−') ? 'var(--danger-color)' : 'var(--success-color)'}">${dayBalance}</div>`;
            if (isWeekend) card.classList.add('weekend');
            if (isHoliday) { card.classList.add('holiday'); card.querySelector('.day-times').textContent = 'Feriado'; }
            if (!isWeekend && !isHoliday) {
                card.classList.add('workday');
                card.dataset.day = day;
                card.addEventListener('click', () => openModal(day, record));
            }
            calendarGrid.appendChild(card);
        }
        renderHolidays(year, month);
    };
    
    const calculateMonthStats = (year, month) => {
        const stats = { totalWorked: 0, finalBalance: 0, totalPositive: 0, totalNegative: 0 };
        if (!currentMonthData.records) return stats;
        for (const day in currentMonthData.records) {
            const record = currentMonthData.records[day];
             if (record && record.times && record.times.every(t => t)) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                const balance = totalWork - WORKDAY_MINUTES;
                stats.totalWorked += totalWork;
                stats.finalBalance += balance;
                if (balance > 0) stats.totalPositive += balance;
                if (balance < 0) stats.totalNegative += balance;
            }
        }
        return stats;
    };
    
    const generateReport = (year, month) => {
        const monthStats = calculateMonthStats(year, month);
        reportGrid.innerHTML = `<div class="report-item"><span>Saldo Final</span><strong style="color: ${monthStats.finalBalance < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">${formatMinutes(monthStats.finalBalance)}</strong></div><div class="report-item"><span>Total Trabalhado</span><strong>${formatMinutes(monthStats.totalWorked, false)}</strong></div><div class="report-item"><span>Total Positivo</span><strong style="color: var(--success-color)">${formatMinutes(monthStats.totalPositive)}</strong></div><div class="report-item"><span>Total Negativo</span><strong style="color: var(--danger-color)">${formatMinutes(monthStats.totalNegative)}</strong></div>`;
    };

    const openModal = (day, record) => {
        currentDayToEdit = day;
        modalTitle.textContent = `Registrar Horários - Dia ${day}`;
        modalForm.reset();
        if (record && record.times) {
            modalForm['modal-time1'].value = record.times[0];
            modalForm['modal-time2'].value = record.times[1];
            modalForm['modal-time3'].value = record.times[2];
            modalForm['modal-time4'].value = record.times[3];
            deleteEntryBtn.classList.remove('hidden');
        } else {
            deleteEntryBtn.classList.add('hidden');
        }
        modal.classList.remove('hidden');
    };
    
    const closeModal = () => {
        modal.classList.add('hidden');
        currentDayToEdit = null;
    };

    const renderHolidays = (year, month) => {
        holidaysList.innerHTML = '';
        const monthHolidays = currentMonthData.holidays || [];
        monthHolidays.forEach(holiday => {
            const li = document.createElement('li');
            li.className = 'holiday-item';
            li.textContent = new Date(holiday + 'T00:00:00').toLocaleDateString('pt-BR');
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-holiday-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => {
                const updatedHolidays = currentMonthData.holidays.filter(h => h !== holiday);
                const year = parseInt(yearSelect.value);
                const month = parseInt(monthSelect.value);
                const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
                db.collection('pontoData').doc(docId).set({ holidays: updatedHolidays }, { merge: true });
            };
            li.appendChild(removeBtn);
            holidaysList.appendChild(li);
        });
    };

    const exportToCSV = (year, month) => {
        // ... (código da função exportToCSV sem alteração)
    };

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    const init = () => {
        monthNames.forEach((name, index) => {
            const option = new Option(name, index);
            monthSelect.add(option);
        });
        
        const today = new Date();
        yearSelect.value = today.getFullYear();
        monthSelect.value = today.getMonth();
        
        listenToMonthData(); 

        monthSelect.addEventListener('change', listenToMonthData);
        yearSelect.addEventListener('change', listenToMonthData);
        
        todayBtn.addEventListener('click', () => {
            const today = new Date();
            yearSelect.value = today.getFullYear();
            monthSelect.value = today.getMonth();
            listenToMonthData();
        });

        modalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
            const docRef = db.collection('pontoData').doc(docId);

            const recordData = {
                times: [
                    modalForm['modal-time1'].value, modalForm['modal-time2'].value,
                    modalForm['modal-time3'].value, modalForm['modal-time4'].value,
                ]
            };

            // *** LÓGICA DE SALVAR CORRIGIDA ***
            docRef.set({
                records: {
                    [currentDayToEdit]: recordData
                }
            }, { merge: true }); // O {merge: true} é crucial para não apagar outros dias

            closeModal();
        });
        
        deleteEntryBtn.addEventListener('click', () => {
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
            const docRef = db.collection('pontoData').doc(docId);
            
            // *** LÓGICA DE APAGAR CORRIGIDA ***
            const fieldToDelete = `records.${currentDayToEdit}`;
            docRef.update({
                [fieldToDelete]: firebase.firestore.FieldValue.delete()
            });

            closeModal();
        });
        
        closeModalBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        addHolidayBtn.addEventListener('click', () => {
            const holidayValue = holidayDateInput.value;
            if (!holidayValue) return;
            
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;

            // *** LÓGICA DE ADICIONAR FERIADO CORRIGIDA ***
            db.collection('pontoData').doc(docId).set({
                holidays: firebase.firestore.FieldValue.arrayUnion(holidayValue)
            }, { merge: true });

            holidayDateInput.value = '';
        });
        
        // ... (Restante dos listeners: exportCsvBtn, calculateExitBtn)
        exportCsvBtn.addEventListener('click', () => { exportToCSV(parseInt(yearSelect.value), parseInt(monthSelect.value)); });
        calculateExitBtn.addEventListener('click', () => { const t1 = document.getElementById('calc-time1').value; const t2 = document.getElementById('calc-time2').value; const t3 = document.getElementById('calc-time3').value; if (!t1 || !t2 || !t3) { alert('Preencha os 3 primeiros horários de hoje para calcular.'); return; } const year = parseInt(yearSelect.value); const month = parseInt(monthSelect.value); const currentBalance = calculateMonthStats(year, month).finalBalance; const morningWork = timeToMinutes(t2) - timeToMinutes(t1); const dailyBalanceNeededMin = -BALANCE_LIMIT_MINUTES - currentBalance; const totalWorkNeededMin = WORKDAY_MINUTES + dailyBalanceNeededMin; const afternoonWorkNeededMin = totalWorkNeededMin - morningWork; const idealExitTimeMin = timeToMinutes(t3) + afternoonWorkNeededMin; const dailyBalanceNeededMax = BALANCE_LIMIT_MINUTES - currentBalance; const totalWorkNeededMax = WORKDAY_MINUTES + dailyBalanceNeededMax; const afternoonWorkNeededMax = totalWorkNeededMax - morningWork; const idealExitTimeMax = timeToMinutes(t3) + afternoonWorkNeededMax; exitResultEl.innerHTML = `<p>Para ficar com saldo de <strong>-01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMin)}</strong></p><p>Para ficar com saldo de <strong>+01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMax)}</strong></p>`; exitResultEl.classList.remove('hidden'); });
    };

    init();
});