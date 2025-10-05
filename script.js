document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO DO FIREBASE ---
    const db = firebase.firestore();
    let unsubscribeFromData; // Variável para guardar o listener em tempo real

    // --- ELEMENTOS DO DOM (sem alteração) ---
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const todayBtn = document.getElementById('today-btn');
    const reportGrid = document.getElementById('report-grid');
    // ... (todos os outros getElementById)
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
    
    // --- FUNÇÕES AUXILIARES DE TEMPO (sem alteração) ---
    const timeToMinutes = (timeStr) => { /* ... */ };
    const formatMinutes = (totalMinutes, withSign = true) => { /* ... */ };
    const minutesToTime = (totalMinutes) => { /* ... */ };

    // --- FUNÇÕES DE DADOS (AGORA COM FIREBASE) ---
    const listenToMonthData = () => {
        if (unsubscribeFromData) {
            unsubscribeFromData(); // Para de ouvir o mês anterior
        }
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Ouve as mudanças no documento do mês em tempo real
        unsubscribeFromData = db.collection('pontoData').doc(docId).onSnapshot(doc => {
            if (doc.exists) {
                currentMonthData = doc.data();
            } else {
                currentMonthData = { holidays: [], records: {} };
            }
            updateUI();
        });
    };

    const saveData = async () => {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
        try {
            await db.collection('pontoData').doc(docId).set(currentMonthData);
        } catch (error) {
            console.error("Erro ao salvar dados: ", error);
        }
    };
    
    // --- FUNÇÕES DE UI E CÁLCULO (com pequenas adaptações) ---
    const updateUI = () => {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        generateCalendar(year, month);
        generateReport(year, month);
    };

    const generateCalendar = (year, month) => {
        calendarGrid.innerHTML = '';
        const date = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            // ... (A lógica interna do generateCalendar continua a mesma, mas usando `currentMonthData`)
            const record = currentMonthData.records[day];
            const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isHoliday = currentMonthData.holidays.includes(dayString);
            // ... resto do código
            
             // Cole o corpo da função generateCalendar da versão anterior aqui
            date.setDate(day);
            const dayOfWeek = date.getDay();
            const card = document.createElement('div');
            card.className = 'day-card';
            let dayBalance = '-';
            let dayTimes = 'Nenhum registro';
            if (record && record.times.every(t => t)) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                const balance = totalWork - WORKDAY_MINUTES;
                dayBalance = formatMinutes(balance);
                dayTimes = `${record.times[0]}-${record.times[1]} / ${record.times[2]}-${record.times[3]}`;
            }
            card.innerHTML = `<div class="day-info">${day} <span>${date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span></div><div class="day-times">${dayTimes}</div><div class="day-balance" style="color: ${dayBalance.startsWith('−') ? 'var(--danger-color)' : 'var(--success-color)'}">${dayBalance}</div>`;
            if (dayOfWeek === 0 || dayOfWeek === 6) card.classList.add('weekend');
            if (isHoliday) { card.classList.add('holiday'); card.querySelector('.day-times').textContent = 'Feriado'; }
            if (!(dayOfWeek === 0 || dayOfWeek === 6) && !isHoliday) {
                card.classList.add('workday');
                card.dataset.day = day;
                card.addEventListener('click', () => openModal(day, record));
            }
            calendarGrid.appendChild(card);
        }
        renderHolidays(year, month);
    };

    const generateReport = (year, month) => {
        const monthStats = calculateMonthStats(year, month);
        // ... (código do generateReport, usando monthStats, sem alterações)
         reportGrid.innerHTML = `<div class="report-item"><span>Saldo Final do Mês</span><strong style="color: ${monthStats.finalBalance < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">${formatMinutes(monthStats.finalBalance)}</strong></div><div class="report-item"><span>Total de Horas Trabalhadas</span><strong>${formatMinutes(monthStats.totalWorked, false)}</strong></div><div class="report-item"><span>Total Saldo Positivo</span><strong style="color: var(--success-color)">${formatMinutes(monthStats.totalPositive)}</strong></div><div class="report-item"><span>Total Saldo Negativo</span><strong style="color: var(--danger-color)">${formatMinutes(monthStats.totalNegative)}</strong></div>`;
    };

    const calculateMonthStats = (year, month) => {
        const stats = { totalWorked: 0, finalBalance: 0, totalPositive: 0, totalNegative: 0 };
        for (const day in currentMonthData.records) {
            // ... (lógica do calculateMonthStats, usando currentMonthData.records)
             const record = currentMonthData.records[day];
             if (record && record.times.every(t => t)) {
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
    
    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    const init = () => {
        // ... (código do init, sem alterações)
        monthNames.forEach((name, index) => { const option = new Option(name, index); monthSelect.add(option); });
        const today = new Date();
        yearSelect.value = today.getFullYear();
        monthSelect.value = today.getMonth();
        
        listenToMonthData(); // Inicia ouvindo o mês atual

        monthSelect.addEventListener('change', listenToMonthData);
        yearSelect.addEventListener('change', listenToMonthData);

        // --- Adicione o corpo de todas as outras funções e listeners aqui ---
        // (openModal, closeModal, renderHolidays, form submit, delete, holiday, etc)
        // A única mudança é que, ao final de cada ação que modifica dados,
        // você deve chamar `saveData()` em vez de `updateUI()`. O `onSnapshot` cuidará de atualizar a UI.
        
        todayBtn.addEventListener('click', () => { /* ... */ });
        modalForm.addEventListener('submit', (e) => { /* ... */ });
        deleteEntryBtn.addEventListener('click', () => { /* ... */ });
        addHolidayBtn.addEventListener('click', () => { /* ... */ });
        // ... cole o corpo de todas as funções restantes aqui
    };

    // Cole o corpo COMPLETO das funções que ficaram faltando aqui,
    // e lembre-se de trocar `updateUI()` por `saveData()` nas ações de modificar dados.
    const timeToMinutes = (timeStr) => { if (!timeStr) return 0; const [hours, minutes] = timeStr.split(':').map(Number); return hours * 60 + minutes; }; const formatMinutes = (totalMinutes, withSign = true) => { if (isNaN(totalMinutes)) return "-"; const sign = totalMinutes < 0 ? '−' : '+'; const absMinutes = Math.abs(Math.round(totalMinutes)); const hours = Math.floor(absMinutes / 60); const minutes = absMinutes % 60; return `${withSign ? sign : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; }; const minutesToTime = (totalMinutes) => { if (totalMinutes < 0) totalMinutes = 0; const hours = Math.floor(totalMinutes / 60) % 24; const minutes = Math.round(totalMinutes % 60); return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; }; const openModal = (day, record) => { currentDayToEdit = day; modalTitle.textContent = `Registrar Horários - Dia ${day}`; modalForm.reset(); if (record) { modalForm['modal-time1'].value = record.times[0]; modalForm['modal-time2'].value = record.times[1]; modalForm['modal-time3'].value = record.times[2]; modalForm['modal-time4'].value = record.times[3]; deleteEntryBtn.classList.remove('hidden'); } else { deleteEntryBtn.classList.add('hidden'); } modal.classList.remove('hidden'); }; const closeModal = () => { modal.classList.add('hidden'); currentDayToEdit = null; }; const renderHolidays = (year, month) => { holidaysList.innerHTML = ''; const monthData = currentMonthData; monthData.holidays.forEach(holiday => { const li = document.createElement('li'); li.className = 'holiday-item'; li.textContent = new Date(holiday + 'T00:00:00').toLocaleDateString('pt-BR'); const removeBtn = document.createElement('span'); removeBtn.className = 'remove-holiday-btn'; removeBtn.textContent = '×'; removeBtn.onclick = () => { monthData.holidays = monthData.holidays.filter(h => h !== holiday); saveData(); }; li.appendChild(removeBtn); holidaysList.appendChild(li); }); }; const calculateCurrentBalance = (year, month) => { return calculateMonthStats(year, month).finalBalance; }; const exportToCSV = (year, month) => { const monthData = currentMonthData; let csvContent = "data:text/csv;charset=utf-8,Dia,Status,Entrada 1,Saida 1,Entrada 2,Saida 2,Total Trabalhado,Saldo Dia\n"; const daysInMonth = new Date(year, month + 1, 0).getDate(); for (let day = 1; day <= daysInMonth; day++) { const date = new Date(year, month, day); const dayOfWeek = date.getDay(); const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; let row = `${day},`; const record = monthData.records[day]; if (dayOfWeek === 0 || dayOfWeek === 6) { row += "Fim de Semana,,,,,,,\n"; } else if (monthData.holidays.includes(dayString)) { row += "Feriado,,,,,,,\n"; } else if (record && record.times.every(t => t)) { const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2])); const balance = totalWork - WORKDAY_MINUTES; row += `Trabalhado,${record.times.join(',')},${formatMinutes(totalWork, false)},${formatMinutes(balance)}\n`; } else { row += "Nao preenchido,,,,,,,\n"; } csvContent += row; } const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `relatorio_ponto_${year}_${monthNames[month]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    todayBtn.addEventListener('click', () => { const today = new Date(); yearSelect.value = today.getFullYear(); monthSelect.value = today.getMonth(); listenToMonthData(); }); modalForm.addEventListener('submit', (e) => { e.preventDefault(); if (currentMonthData.records[currentDayToEdit]) { currentMonthData.records[currentDayToEdit].times = [modalForm['modal-time1'].value, modalForm['modal-time2'].value, modalForm['modal-time3'].value, modalForm['modal-time4'].value,]; } else { currentMonthData.records[currentDayToEdit] = { times: [modalForm['modal-time1'].value, modalForm['modal-time2'].value, modalForm['modal-time3'].value, modalForm['modal-time4'].value,] }; } saveData(); closeModal(); }); deleteEntryBtn.addEventListener('click', () => { if (currentMonthData.records[currentDayToEdit]) { delete currentMonthData.records[currentDayToEdit]; saveData(); closeModal(); } }); closeModalBtn.addEventListener('click', closeModal); modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); }); addHolidayBtn.addEventListener('click', () => { if (!holidayDateInput.value) return; if (!currentMonthData.holidays.includes(holidayDateInput.value)) { currentMonthData.holidays.push(holidayDateInput.value); } saveData(); holidayDateInput.value = ''; }); exportCsvBtn.addEventListener('click', () => { exportToCSV(parseInt(yearSelect.value), parseInt(monthSelect.value)); }); calculateExitBtn.addEventListener('click', () => { const t1 = document.getElementById('calc-time1').value; const t2 = document.getElementById('calc-time2').value; const t3 = document.getElementById('calc-time3').value; if (!t1 || !t2 || !t3) { alert('Preencha os 3 primeiros horários de hoje para calcular.'); return; } const year = parseInt(yearSelect.value); const month = parseInt(monthSelect.value); const currentBalance = calculateCurrentBalance(year, month); const morningWork = timeToMinutes(t2) - timeToMinutes(t1); const dailyBalanceNeededMin = -BALANCE_LIMIT_MINUTES - currentBalance; const totalWorkNeededMin = WORKDAY_MINUTES + dailyBalanceNeededMin; const afternoonWorkNeededMin = totalWorkNeededMin - morningWork; const idealExitTimeMin = timeToMinutes(t3) + afternoonWorkNeededMin; const dailyBalanceNeededMax = BALANCE_LIMIT_MINUTES - currentBalance; const totalWorkNeededMax = WORKDAY_MINUTES + dailyBalanceNeededMax; const afternoonWorkNeededMax = totalWorkNeededMax - morningWork; const idealExitTimeMax = timeToMinutes(t3) + afternoonWorkNeededMax; exitResultEl.innerHTML = `<p>Para ficar com saldo de <strong>-01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMin)}</strong></p><p>Para ficar com saldo de <strong>+01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMax)}</strong></p>`; exitResultEl.classList.remove('hidden'); });

    init();
});