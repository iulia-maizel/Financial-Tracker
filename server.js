const express = require('express');
const fs = require('fs');
const xml2js = require('xml2js');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error serving page');
    }
  });
});

app.get('/financial_data.xml', (req, res) => {
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    res.set('Content-Type', 'text/xml');
    res.send(data);
  });
});

app.get('/api/transactions', (req, res) => {
  fs.readFile('data/financial_data.xml', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const transactions = result.financialData.transactions?.[0]?.transaction || [];
      const formattedTransactions = transactions.map(t => ({
        $: t.$,
        date: Array.isArray(t.date) ? t.date[0] : t.date,
        description: Array.isArray(t.description) ? t.description[0] : t.description,
        amount: Array.isArray(t.amount) ? t.amount[0] : t.amount,
        type: Array.isArray(t.type) ? t.type[0] : t.type,
        category: Array.isArray(t.category) ? t.category[0] : t.category,
        rating: Array.isArray(t.rating) ? t.rating[0] : t.rating || ''
      }));
      res.json(formattedTransactions);
    });
  });
});

app.post('/api/transactions', (req, res) => {
  const newTransaction = req.body;
  const validCategories = ['', 'Chirie', 'Asociație', 'Electricitate', 'Internet', 'Abonamente', 'Groceries', 'For me', 'House'];
  if (!newTransaction.date || !newTransaction.description || !newTransaction.amount || !newTransaction.type) {
    return res.status(400).send('Date, description, amount, and type are required');
  }
  if (isNaN(newTransaction.amount)) {
    return res.status(400).send('Amount must be a valid number');
  }
  if (!['Income', 'Expenses'].includes(newTransaction.type)) {
    return res.status(400).send('Type must be either Income or Expenses');
  }
  if (newTransaction.category && !validCategories.includes(newTransaction.category)) {
    return res.status(400).send('Invalid category');
  }
  fs.readFile('data/financial_data.xml', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      if (!result.financialData.transactions) {
        result.financialData.transactions = [{ transaction: [] }];
      }
      const transactions = result.financialData.transactions[0].transaction || [];
      newTransaction.id = (transactions.length + 1).toString();
      transactions.push({
        $: { id: newTransaction.id },
        date: newTransaction.date,
        description: newTransaction.description,
        amount: parseFloat(newTransaction.amount).toFixed(2),
        type: newTransaction.type,
        category: newTransaction.category || '',
        rating: newTransaction.rating || ''
      });
      result.financialData.transactions[0].transaction = transactions;
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.status(201).json({ id: newTransaction.id });
      });
    });
  });
});

app.get('/api/deadlines', (req, res) => {
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const deadlines = result.financialData.deadlines?.[0]?.deadline || [];
      const formattedDeadlines = deadlines.map(d => ({
        $: d.$,
        description: Array.isArray(d.description) ? d.description[0] : d.description,
        amount: Array.isArray(d.amount) ? d.amount[0] : d.amount,
        type: Array.isArray(d.type) ? d.type[0] : d.type,
        category: Array.isArray(d.category) ? d.category[0] : d.category,
        due_date: String(Array.isArray(d.due_date) ? d.due_date[0] : d.due_date).padStart(2, '0'),
        recurrence: Array.isArray(d.recurrence) ? d.recurrence[0] : d.recurrence,
        recurrence_interval: Array.isArray(d.recurrence_interval) ? d.recurrence_interval[0] : d.recurrence_interval
      }));
      res.json(formattedDeadlines);
    });
  });
});

app.post('/api/deadlines', (req, res) => {
  const newDeadline = req.body;
  const validCategories = ['', 'Chirie', 'Asociație', 'Electricitate', 'Internet', 'Abonamente', 'Groceries', 'For me', 'House'];
  if (!newDeadline.description || !newDeadline.amount || !newDeadline.type || !newDeadline.due_date || !newDeadline.recurrence) {
    return res.status(400).send('Description, amount, type, due_date, and recurrence are required');
  }
  if (isNaN(newDeadline.amount)) {
    return res.status(400).send('Amount must be a valid number');
  }
  if (!['Income', 'Expenses'].includes(newDeadline.type)) {
    return res.status(400).send('Type must be either Income or Expenses');
  }
  if (isNaN(newDeadline.due_date) || newDeadline.due_date < 1 || newDeadline.due_date > 31) {
    return res.status(400).send('Due date must be a number between 1 and 31');
  }
  if (newDeadline.category && !validCategories.includes(newDeadline.category)) {
    return res.status(400).send('Invalid category');
  }
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      if (!result.financialData.deadlines) {
        result.financialData.deadlines = [{ deadline: [] }];
      }
      const deadlines = result.financialData.deadlines[0].deadline || [];
      newDeadline.id = (deadlines.length + 1).toString();
      deadlines.push({
        $: { id: newDeadline.id },
        description: newDeadline.description,
        amount: parseFloat(newDeadline.amount).toFixed(2),
        type: newDeadline.type,
        category: newDeadline.category || '',
        due_date: String(newDeadline.due_date).padStart(2, '0'),
        recurrence: newDeadline.recurrence,
        recurrence_interval: newDeadline.recurrence_interval || ''
      });
      result.financialData.deadlines[0].deadline = deadlines;
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.status(201).json({ id: newDeadline.id });
      });
    });
  });
});

app.get('/api/budgets', (req, res) => {
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const budgets = result.financialData.budgets ? result.financialData.budgets[0].budget || [] : [];
      res.json(budgets.map(b => ({
        category: b.$.category,
        amount: b.$.amount,
        period: b.$.period
      })));
    });
  });
});

app.post('/api/budgets', (req, res) => {
  const newBudget = req.body;
  if (!newBudget.category || !newBudget.amount || !newBudget.period) {
    return res.status(400).send('All fields are required');
  }
  if (isNaN(newBudget.amount) || newBudget.amount <= 0) {
    return res.status(400).send('Amount must be a positive number');
  }
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      if (!result.financialData.budgets) {
        result.financialData.budgets = [{ budget: [] }];
      }
      let budgets = result.financialData.budgets[0].budget || [];
      budgets = budgets.filter(b => !(b.$.category === newBudget.category && b.$.period === newBudget.period));
      budgets.push({ $: { category: newBudget.category, amount: newBudget.amount, period: newBudget.period } });
      result.financialData.budgets[0].budget = budgets;
      const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' }, renderOpts: { pretty: true } });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.status(201).json({ message: 'Budget updated' });
      });
    });
  });
});

app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const updatedTransaction = req.body;
  const validCategories = ['', 'Chirie', 'Asociație', 'Electricitate', 'Internet', 'Abonamente', 'Groceries', 'For me', 'House'];
  if (updatedTransaction.amount && isNaN(updatedTransaction.amount)) {
    return res.status(400).send('Amount must be a valid number');
  }
  if (updatedTransaction.type && !['Income', 'Expenses'].includes(updatedTransaction.type)) {
    return res.status(400).send('Type must be either Income or Expenses');
  }
  if (updatedTransaction.category && !validCategories.includes(updatedTransaction.category)) {
    return res.status(400).send('Invalid category');
  }
  if (updatedTransaction.rating && !['', '1', '2', '3', '4', '5'].includes(updatedTransaction.rating)) {
    return res.status(400).send('Rating must be a number between 1 and 5 or empty');
  }
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const transactions = result.financialData.transactions[0].transaction || [];
      const transactionExists = transactions.some(t => t.$.id === id);
      if (!transactionExists) {
        return res.status(404).send('Transaction not found');
      }
      result.financialData.transactions[0].transaction = transactions.map(t =>
        t.$.id === id ? {
          $: { id },
          date: updatedTransaction.date || t.date,
          description: updatedTransaction.description || t.description,
          amount: updatedTransaction.amount ? parseFloat(updatedTransaction.amount).toFixed(2) : t.amount,
          type: updatedTransaction.type || t.type,
          category: updatedTransaction.category !== undefined ? updatedTransaction.category : t.category,
          rating: updatedTransaction.rating !== undefined ? updatedTransaction.rating : t.rating || ''
        } : t
      );
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.json({ message: 'Transaction updated' });
      });
    });
  });
});

app.put('/api/deadlines/:id', (req, res) => {
  const { id } = req.params;
  const updatedDeadline = req.body;
  const validCategories = ['', 'Chirie', 'Asociație', 'Electricitate', 'Internet', 'Abonamente', 'Groceries', 'For me', 'House'];
  if (updatedDeadline.amount && isNaN(updatedDeadline.amount)) {
    return res.status(400).send('Amount must be a valid number');
  }
  if (updatedDeadline.type && !['Income', 'Expenses'].includes(updatedDeadline.type)) {
    return res.status(400).send('Type must be either Income or Expenses');
  }
  if (updatedDeadline.due_date && (isNaN(updatedDeadline.due_date) || updatedDeadline.due_date < 1 || updatedDeadline.due_date > 31)) {
    return res.status(400).send('Due date must be a number between 1 and 31');
  }
  if (updatedDeadline.category && !validCategories.includes(updatedDeadline.category)) {
    return res.status(400).send('Invalid category');
  }
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const deadlines = result.financialData.deadlines?.[0]?.deadline || [];
      const deadlineExists = deadlines.some(d => d.$.id === id);
      if (!deadlineExists) {
        return res.status(404).send('Deadline not found');
      }
      result.financialData.deadlines[0].deadline = deadlines.map(d =>
        d.$.id === id ? {
          $: { id },
          description: updatedDeadline.description || d.description,
          amount: updatedDeadline.amount ? parseFloat(updatedDeadline.amount).toFixed(2) : d.amount,
          type: updatedDeadline.type || d.type,
          category: updatedDeadline.category !== undefined ? updatedDeadline.category : d.category,
          due_date: updatedDeadline.due_date ? String(updatedDeadline.due_date).padStart(2, '0') : d.due_date,
          recurrence: updatedDeadline.recurrence || d.recurrence,
          recurrence_interval: updatedDeadline.recurrence_interval !== undefined ? updatedDeadline.recurrence_interval : d.recurrence_interval
        } : d
      );
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.json({ message: 'Deadline updated' });
      });
    });
  });
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const transactions = result.financialData.transactions?.[0]?.transaction || [];
      const transactionExists = transactions.some(t => t.$.id === id);
      if (!transactionExists) {
        return res.status(404).send('Transaction not found');
      }
      result.financialData.transactions[0].transaction = transactions.filter(t => t.$.id !== id);
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.json({ message: 'Transaction deleted' });
      });
    });
  });
});

app.delete('/api/deadlines/:id', (req, res) => {
  const { id } = req.params;
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      const deadlines = result.financialData.deadlines?.[0]?.deadline || [];
      const deadlineExists = deadlines.some(d => d.$.id === id);
      if (!deadlineExists) {
        return res.status(404).send('Deadline not found');
      }
      result.financialData.deadlines[0].deadline = deadlines.filter(d => d.$.id !== id);
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.json({ message: 'Deadline deleted' });
      });
    });
  });
});

app.delete('/api/budgets/:category/:period', (req, res) => {
  const { category, period } = req.params;
  fs.readFile('data/financial_data.xml', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading XML:', err);
      return res.status(500).send('Error reading XML');
    }
    xml2js.parseString(data, { trim: true }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).send('Error parsing XML');
      }
      let budgets = result.financialData.budgets?.[0]?.budget || [];
      const initialLength = budgets.length;
      budgets = budgets.filter(b => !(b.$.category === category && b.$.period === period));
      if (budgets.length === initialLength) {
        return res.status(404).send('Budget not found');
      }
      result.financialData.budgets[0].budget = budgets;
      const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true }
      });
      let xmlOutput = builder.buildObject(result);
      const finalXmlOutput = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="../public/financial_data.xsl"?>\n${xmlOutput.replace('<?xml version="1.0" encoding="UTF-8"?>', '').trim()}`;
      fs.writeFile('data/financial_data.xml', finalXmlOutput, (err) => {
        if (err) {
          console.error('Error writing XML:', err);
          return res.status(500).send('Error writing XML');
        }
        res.json({ message: 'Budget deleted' });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
