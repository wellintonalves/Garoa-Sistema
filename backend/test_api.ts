import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

axios.get('http://localhost:3001/barbeiros')
  .then(res => {
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  })
  .catch(err => {
    console.error("Error:", err.response ? err.response.data : err.message);
  });
