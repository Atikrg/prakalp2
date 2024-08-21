const app = require('./app');
const port = 3001;
const ipAddr = '127.0.0.1';


app.get('/', (req, res)=>{
  res.send("<h1>Backend is running 🔥🔥🔥🔥🔥🔥</h1>");
})

app.listen(port, ipAddr, () => {
  console.log(`Server is running on http://${ipAddr}:${port}`);
});
