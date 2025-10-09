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
    const modalLiveBalance = document.getElementById('modal-live-balance');
    const modalTimeInputs = [
        document.getElementById('modal-time1'),
        document.getElementById('modal-time2'),
        document.getElementById('modal-time3'),
        document.getElementById('modal-time4'),
    ];
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

    // --- FUNÇÃO DE CÁLCULO EM TEMPO REAL ---
    const updateLiveBalance = () => {
        const t1 = timeToMinutes(modalTimeInputs[0].value);
        const t2 = timeToMinutes(modalTimeInputs[1].value);
        const t3 = timeToMinutes(modalTimeInputs[2].value);
        const t4 = timeToMinutes(modalTimeInputs[3].value);
        const morningWork = (t1 > 0 && t2 > 0 && t2 > t1) ? t2 - t1 : 0;
        const afternoonWork = (t3 > 0 && t4 > 0 && t4 > t3) ? t4 - t3 : 0;
        const totalWorkMinutes = morningWork + afternoonWork;
        
        if (totalWorkMinutes > 0 || (t1 > 0 && t2 > 0) || (t3 > 0 && t4 > 0)) {
            const balance = totalWorkMinutes - WORKDAY_MINUTES;
            modalLiveBalance.textContent = formatMinutes(balance);
            modalLiveBalance.style.color = balance < 0 ? 'var(--danger-color)' : 'var(--success-color)';
        } else {
            modalLiveBalance.textContent = '--:--';
            modalLiveBalance.style.color = 'inherit';
        }
    };

    // --- FUNÇÕES DE DADOS (FIREBASE) ---
    const listenToMonthData = () => {
        if (unsubscribeFromData) { unsubscribeFromData(); }
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

            if (record && record.times) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                if (!isNaN(totalWork) && totalWork > 0) {
                    const balance = totalWork - WORKDAY_MINUTES;
                    dayBalance = formatMinutes(balance);
                }
                dayTimes = `${record.times[0] || '--:--'}-${record.times[1] || '--:--'} / ${record.times[2] || '--:--'}-${record.times[3] || '--:--'}`;
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
             if (record && record.times && record.times.some(t => t)) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                if (!isNaN(totalWork) && totalWork > 0) {
                    const balance = totalWork - WORKDAY_MINUTES;
                    stats.totalWorked += totalWork;
                    stats.finalBalance += balance;
                    if (balance > 0) stats.totalPositive += balance;
                    if (balance < 0) stats.totalNegative += balance;
                }
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
            modalTimeInputs[0].value = record.times[0];
            modalTimeInputs[1].value = record.times[1];
            modalTimeInputs[2].value = record.times[2];
            modalTimeInputs[3].value = record.times[3];
            deleteEntryBtn.classList.remove('hidden');
        } else {
            deleteEntryBtn.classList.add('hidden');
        }
        updateLiveBalance();
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
                const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
                db.collection('pontoData').doc(docId).update({
                    holidays: firebase.firestore.FieldValue.arrayRemove(holiday)
                });
            };
            li.appendChild(removeBtn);
            holidaysList.appendChild(li);
        });
    };

    const exportToCSV = (year, month) => {
        const monthData = currentMonthData;
        let csvContent = "data:text/csv;charset=utf-8,Dia,Status,Entrada 1,Saida 1,Entrada 2,Saida 2,Total Trabalhado,Saldo Dia\n";
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let row = `${day},`;
            const record = monthData.records ? monthData.records[day] : null;
            if (dayOfWeek === 0 || dayOfWeek === 6) { row += "Fim de Semana,,,,,,,\n"; } 
            else if ((monthData.holidays || []).includes(dayString)) { row += "Feriado,,,,,,,\n"; } 
            else if (record && record.times && record.times.some(t => t)) {
                const totalWork = (timeToMinutes(record.times[1]) - timeToMinutes(record.times[0])) + (timeToMinutes(record.times[3]) - timeToMinutes(record.times[2]));
                const balance = totalWork - WORKDAY_MINUTES;
                row += `Trabalhado,${record.times.join(',')},${formatMinutes(totalWork, false)},${formatMinutes(balance)}\n`;
            } else { row += "Nao preenchido,,,,,,,\n"; }
            csvContent += row;
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_ponto_${year}_${monthNames[month]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    const init = () => {
        monthNames.forEach((name, index) => {
            monthSelect.add(new Option(name, index));
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

        modalTimeInputs.forEach(input => {
            input.addEventListener('input', updateLiveBalance);
        });

        modalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
            const docRef = db.collection('pontoData').doc(docId);

            const recordData = {
                times: [
                    modalTimeInputs[0].value, modalTimeInputs[1].value,
                    modalTimeInputs[2].value, modalTimeInputs[3].value,
                ]
            };
            
            docRef.set({
                records: { [currentDayToEdit]: recordData }
            }, { merge: true }).catch(error => console.error("Erro ao salvar registro:", error));

            closeModal();
        });
        
        deleteEntryBtn.addEventListener('click', () => {
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
            const docRef = db.collection('pontoData').doc(docId);
            const fieldToDelete = `records.${currentDayToEdit}`;
            
            docRef.update({
                [fieldToDelete]: firebase.firestore.FieldValue.delete()
            }).catch(error => console.error("Erro ao apagar registro:", error));

            closeModal();
        });
        
        addHolidayBtn.addEventListener('click', () => {
            const holidayValue = holidayDateInput.value;
            if (!holidayValue) return;
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
            const docRef = db.collection('pontoData').doc(docId);

            docRef.update({
                holidays: firebase.firestore.FieldValue.arrayUnion(holidayValue)
            }).catch(error => { // Adicionado .catch para criar o documento se não existir
                if (error.code === 'not-found') {
                    docRef.set({ holidays: [holidayValue] }, { merge: true });
                } else {
                    console.error("Erro ao adicionar feriado:", error);
                }
            });

            holidayDateInput.value = '';
        });

        closeModalBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        
        exportCsvBtn.addEventListener('click', () => {
            exportToCSV(parseInt(yearSelect.value), parseInt(monthSelect.value));
        });

        calculateExitBtn.addEventListener('click', () => {
            const t1 = document.getElementById('calc-time1').value;
            const t2 = document.getElementById('calc-time2').value;
            const t3 = document.getElementById('calc-time3').value;
            if (!t1 || !t2 || !t3) {
                alert('Preencha os 3 primeiros horários de hoje para calcular.');
                return;
            }
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const currentBalance = calculateMonthStats(year, month).finalBalance;
            const morningWork = timeToMinutes(t2) - timeToMinutes(t1);

            // Cálculo para saldo ZERADO
            const dailyBalanceNeededZero = 0 - currentBalance;
            const totalWorkNeededZero = WORKDAY_MINUTES + dailyBalanceNeededZero;
            const afternoonWorkNeededZero = totalWorkNeededZero - morningWork;
            const idealExitTimeZero = timeToMinutes(t3) + afternoonWorkNeededZero;

            // Cálculo para o limite MÍNIMO (-1h30)
            const dailyBalanceNeededMin = -BALANCE_LIMIT_MINUTES - currentBalance;
            const totalWorkNeededMin = WORKDAY_MINUTES + dailyBalanceNeededMin;
            const afternoonWorkNeededMin = totalWorkNeededMin - morningWork;
            const idealExitTimeMin = timeToMinutes(t3) + afternoonWorkNeededMin;

            // Cálculo para o limite MÁXIMO (+1h30)
            const dailyBalanceNeededMax = BALANCE_LIMIT_MINUTES - currentBalance;
            const totalWorkNeededMax = WORKDAY_MINUTES + dailyBalanceNeededMax;
            const afternoonWorkNeededMax = totalWorkNeededMax - morningWork;
            const idealExitTimeMax = timeToMinutes(t3) + afternoonWorkNeededMax;

            // *** ATUALIZAÇÃO AQUI para incluir o novo horário ***
            exitResultEl.innerHTML = `
                <p>Para ficar com saldo de <strong>-01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMin)}</strong></p>
                <p>Para ficar com saldo <strong>ZERADO</strong>, saia às: <strong>${minutesToTime(idealExitTimeZero)}</strong></p>
                <p>Para ficar com saldo de <strong>+01:30</strong>, saia às: <strong>${minutesToTime(idealExitTimeMax)}</strong></p>
            `;
            exitResultEl.classList.remove('hidden');
        });
    };
    
    init();
});