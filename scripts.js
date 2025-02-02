// Wait until the DOM content is fully loaded before running the script
document.addEventListener('DOMContentLoaded', function () {
    // Helper function to calculate monthly payment
    function calculateMonthlyPayment(loanAmount, interestRate, months) {
        let monthlyInterestRate = (interestRate / 100) / 12;
        let payment = loanAmount * monthlyInterestRate / (1 - Math.pow(1 + monthlyInterestRate, -months));
        return payment;
    }

    // Convert a year-month string to an index (1 = first month of loan term, 360 = last month)
    function convertDateToIndex(yearMonth, loanStartDate) {
        const startYearMonth = loanStartDate.split('-');
        const [startYear, startMonth] = startYearMonth;
        const [year, month] = yearMonth.split('-');

        const yearsDifference = year - startYear;
        const monthsDifference = month - startMonth;

        return yearsDifference * 12 + monthsDifference + 1; // +1 to make the first month 1, not 0
    }

    // Function to parse the extra payments and apply them to the schedule
    function processExtraPayments(extraPayments, loanStartDate) {
        let extraPaymentsMap = {};

        extraPayments.forEach(payment => {
            alert('Processing extra payment: ' + JSON.stringify(payment)); // Debugging alert for extra payments
            if (payment.type === 'one-time') {
                // Convert one-time payment date to index
                const index = convertDateToIndex(payment.when, loanStartDate);
                extraPaymentsMap[index] = (extraPaymentsMap[index] || 0) + parseFloat(payment.amount); // Additive
            } else if (payment.type.startsWith('recurring')) {
                let recurringStartDate = payment.begin; // Renamed to avoid conflict with loan start date
                let endDate = payment.thru;
                let paymentAmount = parseFloat(payment.amount);

                let currentIndex = convertDateToIndex(recurringStartDate, loanStartDate);
                let endIndex = convertDateToIndex(endDate, loanStartDate);

                while (currentIndex <= endIndex) {
                    extraPaymentsMap[currentIndex] = (extraPaymentsMap[currentIndex] || 0) + paymentAmount; // Additive

                    if (payment.type === 'recurring:monthly') {
                        currentIndex++;  // Move to next month
                    } else if (payment.type === 'recurring:yearly') {
                        currentIndex += 12;  // Move to next year
                    }
                }
            }
        });

        alert('Extra Payments Map: ' + JSON.stringify(extraPaymentsMap)); // Debugging alert for extra payments map
        return extraPaymentsMap;
    }

    // Function to generate amortization schedule
    function generateAmortizationSchedule(data) {
        const { loanAmount, interestRate, loanTerm, extraPayments, scheduleType, loanStartDate, outputColumns } = data;

        alert('Generating amortization schedule with data: ' + JSON.stringify(data)); // Debugging alert for the incoming data

        let months = loanTerm * 12;
        let monthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, months);
        let balance = parseFloat(loanAmount);
        let startIndex = convertDateToIndex(loanStartDate, loanStartDate); // Start index from loan start date
        let extraPaymentsMap = processExtraPayments(extraPayments, loanStartDate);

        let schedule = [];
        for (let i = 0; i < months; i++) {
            let interestPayment = balance * (interestRate / 100) / 12;
            let principalPayment = monthlyPayment - interestPayment;

            // First apply the regular payment (interest + principal)
            balance -= principalPayment;

            // Now apply any extra payment for the current month (based on index)
            let extraPayment = extraPaymentsMap[startIndex + i] || 0;
            balance -= extraPayment;  // Extra payments come at the end of the month

            // Add the row to the schedule
            schedule.push({
                Date: new Date(new Date(loanStartDate).setMonth(new Date(loanStartDate).getMonth() + i)).toISOString().split('T')[0],
                Principal: principalPayment.toFixed(2),
                Interest: interestPayment.toFixed(2),
                'Extra Principal': extraPayment.toFixed(2),
                Balance: balance.toFixed(2)
            });
        }

        alert('Generated Schedule: ' + JSON.stringify(schedule)); // Debugging alert for the final schedule
        return schedule;
    }

    // Function to render the schedule in HTML
    function renderSchedule(schedule) {
        const tableContainer = document.getElementById('schedule-container');
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');

        schedule[0] && Object.keys(schedule[0]).forEach(key => {
            const th = document.createElement('th');
            th.innerText = key;
            headerRow.appendChild(th);
        });

        table.appendChild(headerRow);

        schedule.forEach(row => {
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                td.innerText = value;
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    // Function to convert schedule to CSV
    function convertToCSV(schedule) {
        const header = Object.keys(schedule[0]);
        const rows = schedule.map(row => Object.values(row));

        let csv = header.join(',') + '\n';
        rows.forEach(row => {
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    // Function to handle file input and process the data
    document.getElementById('json-file').addEventListener('change', function(event) {
        const file = event.target.files[0];
        alert('File selected: ' + file.name); // Debugging alert for file input
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = JSON.parse(e.target.result);
                alert('Loaded JSON: ' + JSON.stringify(data));  // Debugging alert to check JSON loading
                const schedule = generateAmortizationSchedule(data);
                renderSchedule(schedule);

                // Enable the download CSV button
                document.getElementById('download-csv').addEventListener('click', function() {
                    const csv = convertToCSV(schedule);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'amortization_schedule.csv';
                    link.click();
                });
            };
            reader.readAsText(file);
        } else {
            alert('Please upload a valid JSON file.');
        }
    });

});
