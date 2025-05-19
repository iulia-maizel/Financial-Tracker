let chartInstance = null;
let isLoadingTransactions = false;
let calendarInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

  const exportButton = document.getElementById('export-analytics');
  const exportFormat = document.getElementById('exportFormat');
  if (exportButton && exportFormat) {
    exportButton.addEventListener('click', () => {
      const format = exportFormat.value;
      console.log('Export button clicked, format:', format);
      exportTransactions(format);
    });
  } else {
    console.error('Export button or format selector not found');
  }

function initializeApp() {
  loadTransactions();
  initializeCalendar();
  document.getElementById('transaction-form').addEventListener('submit', addTransaction);
  document.getElementById('budget-form').addEventListener('submit', setBudget);
  document.getElementById('deadline-form').addEventListener('submit', addDeadline);
  document.getElementById('categoryFilter').addEventListener('change', loadTransactions);
  document.getElementById('secondaryCategoryFilter').addEventListener('change', loadTransactions);
  loadBudgetOptions();
}

function toggleCustomInterval() {
  const recurrence = document.getElementById('ddl-recurrence').value;
  document.getElementById('custom-interval-label').style.display = recurrence === 'custom' ? 'block' : 'none';
}

function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  if (calendarInstance) {
    calendarInstance.destroy();
  }

  calendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: async (info, successCallback) => {
      try {
        const response = await fetch('/api/deadlines');
        if (!response.ok) throw new Error(`Failed to fetch deadlines: ${response.statusText}`);
        const deadlines = await response.json();

        const currentYear = new Date().getFullYear();
        const events = [];

        deadlines
          .filter(d => d.due_date)
          .forEach(d => {
            const dueDate = String(d.due_date).padStart(2, '0');
            const description = d.description || 'Unknown';
            const amount = d.amount || '0';
            const type = d.type || 'Unknown';
            const category = d.category || '';
            const recurrence = d.recurrence || 'monthly';
            const interval = d.recurrence_interval ? parseInt(d.recurrence_interval) : null;
            const id = d.$?.id || d.id;

            const baseDate = new Date(`${currentYear}-01-${dueDate}`);
            const eventBase = {
              id: id,
              title: `${description} (${amount})`,
              className: type === 'Income' ? 'fc-event-income' : 'fc-event-expenses',
              extendedProps: { type, category, amount, recurrence }
            };

            if (recurrence === 'monthly') {
              for (let month = 0; month < 12; month++) {
                const eventDate = new Date(currentYear, month, parseInt(dueDate));
                if (eventDate.getDate() === parseInt(dueDate)) {
                  events.push({
                    ...eventBase,
                    start: `${currentYear}-${String(month + 1).padStart(2, '0')}-${dueDate}`
                  });
                }
              }
            } else if (recurrence === 'weekly') {
              for (let day = 0; day < 365; day += 7) {
                const eventDate = new Date(baseDate);
                eventDate.setDate(baseDate.getDate() + day);
                if (eventDate.getFullYear() === currentYear) {
                  events.push({
                    ...eventBase,
                    start: eventDate.toISOString().split('T')[0]
                  });
                }
              }
            } else if (recurrence === 'yearly') {
              events.push({
                ...eventBase,
                start: `${currentYear}-01-${dueDate}`
              });
            } else if (recurrence === 'custom' && interval > 0) {
              for (let day = 0; day < 365; day += interval) {
                const eventDate = new Date(baseDate);
                eventDate.setDate(baseDate.getDate() + day);
                if (eventDate.getFullYear() === currentYear) {
                  events.push({
                    ...eventBase,
                    start: eventDate.toISOString().split('T')[0]
                  });
                }
              }
            }
          });

        successCallback(events);
      } catch (err) {
        console.error('Error loading calendar events:', err);
        successCallback([]);
      }
    },
    eventClick: function(info) {
      if (confirm(`Delete deadline "${info.event.title}"?`)) {
        deleteDeadline(info.event.id);
      }
    }
  });
  calendarInstance.render();
}

async function addTransaction(e) {
  e.preventDefault();
  const transaction = {
    date: document.getElementById('date').value,
    description: document.getElementById('description').value,
    amount: parseFloat(document.getElementById('amount').value).toFixed(2),
    type: document.getElementById('type').value,
    category: document.getElementById('category').value || ''
  };

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!response.ok) throw new Error(await response.text());

    const transactionId = (await response.json()).id || (await fetch('/api/transactions').then(r => r.json())).slice(-1)[0].$.id;
    document.getElementById('transaction-form').reset();
    updateCategoryDropdown();

    if (transaction.type === 'Expenses' && ['For me', 'House'].includes(transaction.category)) {
      await promptForRating(transactionId);
    }

    loadTransactions();
  } catch (err) {
    console.error('Error adding transaction:', err);
    alert('Error adding transaction');
  }
}

async function promptForRating(transactionId) {
  const modal = document.getElementById('rating-modal');
  modal.style.display = 'flex';

  return new Promise(resolve => {
    const submitButton = document.getElementById('submit-rating');
    const skipButton = document.getElementById('skip-rating');
    const ratingInputs = document.querySelectorAll('input[name="rating"]');

    const submitHandler = async () => {
      const rating = document.querySelector('input[name="rating"]:checked')?.value || '';
      if (rating) {
        try {
          const response = await fetch(`/api/transactions/${transactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
          });
          if (!response.ok) throw new Error(await response.text());
        } catch (err) {
          console.error('Error updating rating:', err);
          alert('Error updating rating');
        }
      }
      modal.style.display = 'none';
      ratingInputs.forEach(input => input.checked = false);
      submitButton.removeEventListener('click', submitHandler);
      skipButton.removeEventListener('click', skipHandler);
      resolve();
    };

    const skipHandler = () => {
      modal.style.display = 'none';
      ratingInputs.forEach(input => input.checked = false);
      submitButton.removeEventListener('click', submitHandler);
      skipButton.removeEventListener('click', skipHandler);
      resolve();
    };

    submitButton.addEventListener('click', submitHandler);
    skipButton.addEventListener('click', skipHandler);
  });
}

async function addDeadline(e) {
  e.preventDefault();
  const dueDate = document.getElementById('ddl-due-date').value;
  if (dueDate < 1 || dueDate > 31) {
    alert('Due date must be between 1 and 31');
    return;
  }

  const recurrence = document.getElementById('ddl-recurrence').value;
  let recurrenceInterval = '';
  if (recurrence === 'custom') {
    recurrenceInterval = document.getElementById('ddl-recurrence-interval').value;
    if (!recurrenceInterval || parseInt(recurrenceInterval) <= 0) {
      alert('Please enter a valid positive interval for custom recurrence');
      return;
    }
  }

  const deadline = {
    description: document.getElementById('ddl-description').value,
    amount: parseFloat(document.getElementById('ddl-amount').value).toFixed(2),
    type: document.getElementById('ddl-type').value,
    category: document.getElementById('ddl-category').value || '',
    due_date: String(dueDate).padStart(2, '0'),
    recurrence: recurrence,
    recurrence_interval: recurrenceInterval
  };

  try {
    const response = await fetch('/api/deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deadline)
    });
    if (!response.ok) throw new Error(await response.text());
    document.getElementById('deadline-form').reset();
    toggleCustomInterval();
    updateDdlCategoryDropdown();
    loadTransactions();
    document.getElementById('calendar').innerHTML = '';
    initializeCalendar();
  } catch (err) {
    console.error('Error adding deadline:', err);
    alert('Error adding deadline');
  }
}

async function deleteDeadline(id) {
  if (confirm('Delete this deadline?')) {
    try {
      const response = await fetch(`/api/deadlines/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(await response.text());
      loadTransactions();
      document.getElementById('calendar').innerHTML = '';
      initializeCalendar();
    } catch (err) {
      console.error('Error deleting deadline:', err);
      alert('Error deleting deadline');
    }
  }
}

function loadTransactions() {
  if (isLoadingTransactions) return;
  isLoadingTransactions = true;

  const categoryFilter = document.getElementById('categoryFilter').value;
  const secondaryCategoryFilter = document.getElementById('secondaryCategoryFilter').value || 'All';

  Promise.all([
    fetch('/financial_data.xml').then(res => res.text()),
    fetch('/financial_data.xsl').then(res => res.text())
  ])
    .then(([xmlData, xslData]) => {
      const xmlParser = new DOMParser();
      const xmlDoc = xmlParser.parseFromString(xmlData, 'application/xml');
      if (xmlDoc.querySelector('parsererror')) {
        throw new Error('XML parsing error: ' + xmlDoc.querySelector('parsererror').textContent);
      }

      const xslParser = new DOMParser();
      const xslDoc = xslParser.parseFromString(xslData, 'application/xml');
      const xslError = xslDoc.querySelector('parsererror');
      if (xslError) {
        console.error('XSLT parsing error:', xslError.textContent);
        console.error('XSLT content:', xslData);
        throw new Error('XSLT parsing error: ' + xslError.textContent);
      }

      const xsltProcessor = new XSLTProcessor();
      xsltProcessor.setParameter(null, 'categoryFilter', categoryFilter);
      xsltProcessor.setParameter(null, 'secondaryCategoryFilter', secondaryCategoryFilter);
      xsltProcessor.importStylesheet(xslDoc);
      const resultDocument = xsltProcessor.transformToFragment(xmlDoc, document);
      if (!resultDocument) {
        throw new Error('XSLT transformation returned null');
      }

      const dashboard = document.getElementById('dashboard');
      dashboard.innerHTML = '';
      dashboard.appendChild(resultDocument);

      return fetch('/api/transactions')
        .then(response => response.json())
        .then(transactions => {
          const filteredTransactions = transactions.filter(t => 
            (categoryFilter === 'All' || t.type === categoryFilter) &&
            (secondaryCategoryFilter === 'All' || t.category === secondaryCategoryFilter || (t.category === '' && secondaryCategoryFilter === 'None'))
          );

          const analyticsSummary = document.getElementById('analytics-summary');
          analyticsSummary.innerHTML = '';

          if (filteredTransactions.length === 0) {
            analyticsSummary.innerHTML = '<div class="analytics-item"><span>No analytics data available.</span></div>';
          } else {
            const totalIncome = filteredTransactions
              .filter(t => t.type === 'Income')
              .reduce((sum, t) => sum + parseFloat(t.amount), 0)
              .toFixed(2);
            const totalExpenses = filteredTransactions
              .filter(t => t.type === 'Expenses')
              .reduce((sum, t) => sum + parseFloat(t.amount), 0)
              .toFixed(2);

            let analyticsHTML = `
              <div class="analytics-item">
                <strong>Total Income:</strong>
                <span class="positive">${parseFloat(totalIncome).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="analytics-item">
                <strong>Total Expenses:</strong>
                <span class="negative">${parseFloat(totalExpenses).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="analytics-item">
                <strong>Expenses by Category:</strong>
              </div>
            `;

            const categorySums = {};
            filteredTransactions
              .filter(t => t.type === 'Expenses' && t.category !== '')
              .forEach(t => {
                const category = t.category;
                if (!categorySums[category]) {
                  categorySums[category] = 0;
                }
                categorySums[category] += Math.abs(parseFloat(t.amount));
              });

            const sortedCategories = Object.keys(categorySums).sort();
            sortedCategories.forEach(category => {
              analyticsHTML += `
                <div class="analytics-item">
                  <span>${category}:</span>
                  <span class="negative">${categorySums[category].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              `;
            });

            analyticsSummary.innerHTML = analyticsHTML;
          }

          if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
          }

          const categorySumsForChart = {};
          filteredTransactions
            .filter(t => t.type === 'Expenses' && t.category)
            .forEach(t => {
              const category = t.category || 'Unknown';
              const amount = parseFloat(t.amount) || 0;
              if (!categorySumsForChart[category]) categorySumsForChart[category] = 0;
              categorySumsForChart[category] += Math.abs(amount);
            });

          const labels = Object.keys(categorySumsForChart);
          const data = Object.values(categorySumsForChart);
          const colors = [
            '#EECEDA', '#CCD5AE', '#D5E3E8', '#F7D9C4',
            '#BDB2FF', '#A8D1D1', '#F1F7B5', '#EDD7C8'
          ];

          const canvas = document.getElementById('analyticsChart');
          if (canvas) {
            chartInstance = new Chart(canvas, {
              type: 'pie',
              data: {
                labels: labels,
                datasets: [{
                  label: 'Expenses Breakdown by Category',
                  data: data,
                  backgroundColor: colors.slice(0, labels.length),
                  borderColor: '#fff',
                  borderWidth: 2
                }]
              },
              options: {
                responsive: true,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: 'Expenses Breakdown by Category' }
                }
              }
            });
          }

          generateHappinessInsights(transactions);
        });
    })
    .then(() => {
      attachButtonListeners();
    })
    .catch(error => {
      console.error('Error loading transactions:', error);
      document.getElementById('dashboard').innerHTML = `<p>Error: ${error.message}. Check console for details.</p>`;
      document.getElementById('analytics-summary').innerHTML = `<p>Error: ${error.message}.</p>`;
    })
    .finally(() => {
      isLoadingTransactions = false;
    });
}

function generateHappinessInsights(transactions) {
  const insightsDiv = document.getElementById('happiness-insight');
  insightsDiv.innerHTML = '';

  const categoryStats = {};
  transactions
    .filter(t => t.type === 'Expenses' && t.rating && t.category)
    .forEach(t => {
      const category = t.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { totalRating: 0, totalAmount: 0, count: 0 };
      }
      categoryStats[category].totalRating += parseFloat(t.rating);
      categoryStats[category].totalAmount += Math.abs(parseFloat(t.amount));
      categoryStats[category].count += 1;
    });

  const insightsContainer = document.createElement('div');
  insightsContainer.className = 'insights-container';

  if (Object.keys(categoryStats).length === 0) {
    insightsContainer.innerHTML = '<p>No happiness insights available.</p>';
  } else {
    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category];
      const avgRating = (stats.totalRating / stats.count).toFixed(1);
      const starsPerEuro = stats.totalAmount > 0 ? (stats.totalRating / stats.totalAmount).toFixed(2) : 0;

      let emoji = '😊';
      if (avgRating >= 4) {
        emoji = '😄';
      } else if (avgRating >= 3) {
        emoji = '😃';
      }

      const insightCard = document.createElement('div');
      insightCard.className = 'insight-card';
      insightCard.innerHTML = `
        <div class="insight-header">
          <h4>${category}</h4>
          <span class="insight-emoji">${emoji}</span>
        </div>
        <p>Average Rating: ${avgRating} ★</p>
        <p>${starsPerEuro} ★ per € spent (${stats.count} transaction${stats.count > 1 ? 's' : ''})</p>
      `;
      insightsContainer.appendChild(insightCard);
    });
  }

  insightsDiv.appendChild(insightsContainer);
}

function loadBudgetOptions() {
  fetch('/api/budgets')
    .then(response => response.json())
    .then(budgets => {
      const select = document.getElementById('budget-select');
      select.innerHTML = '<option value="">New Budget</option>';
      budgets.forEach(b => {
        const option = document.createElement('option');
        option.value = `${b.category}|${b.period}`;
        option.text = `${b.category} (${b.period}): ${b.amount}`;
        select.appendChild(option);
      });
    })
    .catch(error => console.error('Error loading budgets:', error));
}

function loadBudget() {
  const [category, period] = document.getElementById('budget-select').value.split('|') || ['', ''];
  if (!category) {
    document.getElementById('budget-category').value = 'Income';
    document.getElementById('budget-amount').value = '';
    document.getElementById('budget-period').value = 'monthly';
    return;
  }
  fetch('/api/budgets')
    .then(response => response.json())
    .then(budgets => {
      const budget = budgets.find(b => b.category === category && b.period === period);
      if (budget) {
        document.getElementById('budget-category').value = budget.category;
        document.getElementById('budget-amount').value = budget.amount;
        document.getElementById('budget-period').value = budget.period;
      }
    })
    .catch(error => console.error('Error loading budget:', error));
}

function setBudget(event) {
  event.preventDefault();
  const budget = {
    category: document.getElementById('budget-category').value,
    amount: parseFloat(document.getElementById('budget-amount').value).toFixed(2),
    period: document.getElementById('budget-period').value
  };
  if (isNaN(budget.amount) || budget.amount <= 0) {
    alert('Please enter a valid positive amount');
    return;
  }
  fetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(budget)
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to set budget');
      document.getElementById('budget-form').reset();
      loadBudgetOptions();
      loadTransactions();
    })
    .catch(error => {
      console.error('Error setting budget:', error);
      alert('Failed to set budget');
    });
}

function attachButtonListeners() {
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.removeEventListener('click', handleEdit);
    button.addEventListener('click', handleEdit);
  });
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.removeEventListener('click', handleDelete);
    button.addEventListener('click', handleDelete);
  });
}

function handleEdit() {
  const id = this.dataset.id;
  editTransaction(id);
}

function handleDelete() {
  const id = this.dataset.id;
  const type = this.dataset.type;
  if (type === 'deadline') {
    deleteDeadline(id);
  } else {
    deleteTransaction(id);
  }
}

function exportTransactions(format = 'csv') {
  fetch('/api/transactions')
    .then(response => response.json())
    .then(transactions => {
      let content, mimeType, fileName;

      if (format === 'csv') {
        const csv = ['id,date,description,amount,type,category,rating'];
        transactions.forEach(t => {
          csv.push(`${t.$.id},${t.date},${t.description},${t.amount},${t.type},${t.category},${t.rating || ''}`);
        });
        content = csv.join('\n');
        mimeType = 'text/csv';
        fileName = 'transactions.csv';
      } else if (format === 'xml') {
        const xmlRows = transactions.map(t => `
  <transaction id="${t.$.id}">
    <date>${t.date}</date>
    <description>${t.description}</description>
    <amount>${t.amount}</amount>
    <type>${t.type}</type>
    <category>${t.category}</category>
    <rating>${t.rating || ''}</rating>
  </transaction>`).join('');
        content = `<?xml version="1.0" encoding="UTF-8"?>\n<transactions>${xmlRows}\n</transactions>`;
        mimeType = 'application/xml';
        fileName = 'transactions.xml';
      } else if (format === 'pdf') {
        const pdfWindow = window.open('', '', 'width=800,height=600');
        pdfWindow.document.write('<html><head><title>Transactions</title></head><body>');
        pdfWindow.document.write('<h1>Transactions</h1><table border="1"><tr><th>ID</th><th>Date</th><th>Description</th><th>Amount</th><th>Type</th><th>Category</th><th>Rating</th></tr>');
        transactions.forEach(t => {
          pdfWindow.document.write(`<tr><td>${t.$.id}</td><td>${t.date}</td><td>${t.description}</td><td>${t.amount}</td><td>${t.type}</td><td>${t.category}</td><td>${t.rating || ''}</td></tr>`);
        });
        pdfWindow.document.write('</table></body></html>');
        pdfWindow.document.close();
        pdfWindow.print();
        return;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(error => console.error('Error exporting transactions:', error));
}

async function editTransaction(id) {
  const newAmount = prompt('Enter new amount:');
  const newRating = ['For me', 'House'].includes(document.querySelector(`[data-id="${id}"]`)?.closest('tr').querySelector('td:nth-child(6)')?.textContent) ? prompt('Enter new rating (1-5, or leave blank):') : null;
  if (newAmount && !isNaN(parseFloat(newAmount))) {
    const updatedTransaction = { amount: parseFloat(newAmount).toFixed(2) };
    if (newRating !== null && (newRating === '' || (parseInt(newRating) >= 1 && parseInt(newRating) <= 5))) {
      updatedTransaction.rating = newRating;
    }
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTransaction)
      });
      if (!response.ok) throw new Error(await response.text());
      loadTransactions();
    } catch (err) {
      console.error('Error updating transaction:', err);
      alert('Error updating transaction');
    }
  } else {
    alert('Please enter a valid amount');
  }
}

async function deleteTransaction(id) {
  if (confirm('Delete this transaction?')) {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(await response.text());
      loadTransactions();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert('Error deleting transaction');
    }
  }
}

function updateCategoryDropdown() {
  const type = document.getElementById('type').value;
  const categoryLabel = document.getElementById('category-label');
  const categorySelect = document.getElementById('category');
  if (categoryLabel && categorySelect) {
    categoryLabel.style.display = type === 'Expenses' ? 'block' : 'none';
    categorySelect.style.display = type === 'Expenses' ? 'block' : 'none';
    categorySelect.value = type === 'Expenses' ? 'Chirie' : '';
  }
}

function updateDdlCategoryDropdown() {
  const type = document.getElementById('ddl-type').value;
  const categoryLabel = document.getElementById('ddl-category-label');
  const categorySelect = document.getElementById('ddl-category');
  if (categoryLabel && categorySelect) {
    categoryLabel.style.display = type === 'Expenses' ? 'block' : 'none';
    categorySelect.style.display = type === 'Expenses' ? 'block' : 'none';
    categorySelect.value = type === 'Expenses' ? 'Chirie' : '';
  }
}