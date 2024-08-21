const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const profileRoutes = require('./routes/profileRoutes');
const taskRoutes = require('./routes/taskRoutes');
const projectRoutes = require('./routes/projectRoutes');

const app = express();
app.use(cors()); 
app.use(bodyParser.json());

app.use('/api', profileRoutes);
app.use('/api', taskRoutes);
app.use('/api', projectRoutes);

module.exports = app;
