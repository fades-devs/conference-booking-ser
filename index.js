const express = require('express');
const app = express();
const port = process.env.PORT || 3003 ; // 3003 for Booking Service

app.get('/', (req, res) => {
  res.json({ service: 'Booking Service', status: 'Active' });
});

app.listen(port, () => {
  console.log(`Booking Service running on port ${port}`);
});