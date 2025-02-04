let loanData = null;
let amortizationSchedule = [];

document.getElementById('jsonFile').addEventListener('change', handleFileUpload);
document.getElementById('toggleEditor').addEventListener('click', toggleEditor);
document.querySelector('.close').addEventListener('click', closeModal);

function handleFileUpload(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    loanData = JSON.parse(e.target.result);
    document.getElementById('jsonTextArea').value = JSON.stringify(loanData, null, 2);
    refreshSchedule();
  };
  reader.readAsText(file);
}

function toggleEditor() {
  const editorContainer = document.getElementById('editorContainer');
  const isCollapsed = editorContainer.classList.contains('collapsed');
  if (isCollapsed) {
    editorContainer.classList.remove('collapsed');
    editorContainer.classList.add('expanded');
  } else {
    editorContainer.classList.remove('expanded');
    editorContainer.classList.add('collapsed');
  }
}

function refreshSchedule() {
  try {
    loanData = JSON.parse(document.getElementById('jsonTextArea').value);
    generateAmortizationSchedule();
  } catch (error) {
    alert('Invalid JSON format');
  }
}

function generateAmortizationSchedule() {
  if (!loanData) return;

  const loanAmount = parseFloat(loanData.loanAmount);
  const interestRate = parseFloat(loanData.interestRate) / 100;
  const loanTermInMonths = loanData.loanTerm.includes('months')
    ? parseInt(loanData.loanTerm)
    : parseInt(loanData.loanTerm) * 12;
  const firstPaymentDate = new Date(loanData.firstPaymentDate);
  const extraPayments = loanData.extraPayments.map(payment => ({
    ...payment,
    amount: parseFloat(payment.amount),
    begin: new Date(payment.begin),
    end: new Date(payment.end),
  }));

  // Step 1: Expand recurring payments (e.g., monthly, yearly)
  const expandedExtraPayments = [];
  extraPayments.forEach(payment => {
    if (payment.duration === 'monthly' || payment.duration === 'yearly') {
      let paymentDate = new Date(payment.begin);
      const endDate = new Date(payment.end);

      // Generate payments for the duration of the period
      while (paymentDate <= endDate) {
        expandedExtraPayments.push({
          amount: payment.amount,
          begin: new Date(paymentDate),
          end: new Date(paymentDate),
          duration: 'once',
        });

        // Move the payment date forward based on the duration
        if (payment.duration === 'monthly') {
          paymentDate.setMonth(paymentDate.getMonth() + 1);
        } else if (payment.duration === 'yearly') {
          paymentDate.setFullYear(paymentDate.getFullYear() + 1);
        }
      }
    } else {
      expandedExtraPayments.push(payment); // One-time payments
    }
  });

  // Step 2: Determine periods based on startDate and firstPaymentDate
  let periods = [];
  let periodStartDate = new Date(loanData.startDate);
  let periodEndDate = new Date(firstPaymentDate);

  // Add the first period (startDate to firstPaymentDate)
  periods.push({ start: periodStartDate, end: periodEndDate });

  // Now determine the subsequent periods
  for (let i = 1; i <= loanTermInMonths; i++) {
    periodStartDate = new Date(periodEndDate);
    periodStartDate.setDate(periodStartDate.getDate() + 1); // One day after the last payment

    // Move the end date to the next payment date
    periodEndDate = new Date(periodStartDate);
    periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    periodEndDate.setDate(periodEndDate.getDate() - 1); // One day before next payment date

    periods.push({ start: periodStartDate, end: periodEndDate });
  }

  // Step 3: Calculate amortization and apply extra payments
  const monthlyRate = interestRate / 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTermInMonths)) / (Math.pow(1 + monthlyRate, loanTermInMonths) - 1);

  let balance = loanAmount;
  let paymentDate = new Date(firstPaymentDate);

  amortizationSchedule = [];

  // Loop through each period and calculate payments
  periods.forEach((period, index) => {
    // Apply all extra payments that occurred within the current period
    let periodExtraPayments = expandedExtraPayments.filter(payment => {
      return payment.begin >= period.start && payment.end <= period.end;
    });

    // Calculate total extra payment for this period
    let extraPaymentAmount = periodExtraPayments.reduce((sum, p) => sum + p.amount, 0);
    balance -= extraPaymentAmount;

    // Calculate interest and principal for this period
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;

    amortizationSchedule.push({
      paymentDate: new Date(paymentDate),
      paymentAmount: monthlyPayment + extraPaymentAmount,
      principalPayment: principalPayment,
      interestPayment: interestPayment,
      remainingBalance: Math.max(balance, 0),
      extraPayments: periodExtraPayments,
    });

    // Increment the payment date by one month for the next period
    paymentDate.setMonth(paymentDate.getMonth() + 1);
  });

  renderTable();
}


function renderTable() {
  const tableBody = document.querySelector('#scheduleTable tbody');
  tableBody.innerHTML = '';
  amortizationSchedule.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.addEventListener('click', () => showExtraPayments(row.extraPayments));
    tr.innerHTML = `
      <td>${row.paymentDate.toLocaleDateString()}</td>
      <td>${row.paymentAmount.toFixed(2)}</td>
      <td>${row.principalPayment.toFixed(2)}</td>
      <td>${row.interestPayment.toFixed(2)}</td>
      <td>${row.remainingBalance.toFixed(2)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function showExtraPayments(extraPayments) {
  const extraPaymentsList = document.getElementById('extraPaymentsList');
  extraPaymentsList.innerHTML = '';
  extraPayments.forEach(payment => {
    const li = document.createElement('li');
    li.textContent = `Amount: $${payment.amount} on ${payment.begin.toLocaleDateString()}`;
    extraPaymentsList.appendChild(li);
  });

  const modal = document.getElementById('extraPaymentsModal');
  modal.style.display = "block";
}

function closeModal() {
  const modal = document.getElementById('extraPaymentsModal');
  modal.style.display = "none";
}

function downloadCSV() {
  const csvRows = [];
  const headers = ['Payment Date', 'Payment Amount', 'Principal Payment', 'Interest Payment', 'Remaining Balance'];
  csvRows.push(headers.join(','));

  amortizationSchedule.forEach(row => {
    const rowData = [
      row.paymentDate.toLocaleDateString(),
      row.paymentAmount.toFixed(2),
      row.principalPayment.toFixed(2),
      row.interestPayment.toFixed(2),
      row.remainingBalance.toFixed(2)
    ];
    csvRows.push(rowData.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'amortization_schedule.csv';
  link.click();
}
