require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const port = process.env.PORT || 3000;

const mysql = require('mysql');
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
});
connection.query('SELECT * FROM customers', (err,rows) => {
  if(err) throw err;

  console.log('Data received from Db:');
  console.log(rows);
});



const io = new Server(server,{
    cors: {
        origin: "*",
        credentials: true,
      },
    handlePreflightRequest: (req, res) => {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST",
          "Access-Control-Allow-Credentials": true,
        });
        res.end();
      },
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection',(socket)=>{
    
    socket.on('subscribe', function(room) { 
        console.log('joining room', room.channel);
        socket.join(room.channel); 
    })
  
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('chitmaymay',(msg)=>{
      const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,sender_name:msg.sender_name,sender_conv_key:msg.sender_conv_key,receive_id:msg.receive_id,receive_name:msg.receive_name,receive_conv_key:msg.receive_conv_key,conversation_key:msg.conversation_key,created_at:msg.created_at };
      connection.query('INSERT INTO messages SET ?', msgdata, (err, res) => {
        if(err) throw err;
      
        io.in(msg.receive_conv_key).emit('chitmaymay', msg);
      });

       
      
    });
    
});
server.listen(port, () => {
  console.log('listening on *:' + port);
});