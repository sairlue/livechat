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

io.on('connection',(data)=>{
    
  data.on('subscribe', function(room) { 
        console.log('joining room', room.channel);
        data.join(room.channel); 
    })
  
    data.on('disconnect', () => {
        console.log('user disconnected');
    });

    data.on('chitmaymay',(msg)=>{
      let conv_key = "";
      if(msg.conversation_key){
         conv_key = msg.conversation_key;
      }else{
        var min = 100000000;
        var max = 999999999;
        var rmint =  Math.floor(Math.random() * (max - min)) + min;
        let key = "CHAT_" + rmint;
        var conv = {
          start_user:msg.sender_id,end_user:msg.receive_id,conv_key:key
        };
        connection.query('INSERT INTO chat_conversations SET ?', conv, (err, res) => {
          if(err) throw err;
        
           conv_key = res.conv_key;
        });
      }
      
     
      if(msg.chat_type == 'group'){
        const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,sender_name:msg.sender_name,sender_conv_key:msg.sender_conv_key,group_id:msg.receive_id,group_name:msg.receive_name,group_conv_key:msg.receive_conv_key };
        connection.query('INSERT INTO message_groups SET ?', msgdata, (err, res) => {
          if(err) throw err;
        
          io.in(msg.receive_conv_key).emit('chitmaymay', msg);
        });
      }else{
        const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,sender_name:msg.sender_name,sender_conv_key:msg.sender_conv_key,receive_id:msg.receive_id,receive_name:msg.receive_name,receive_conv_key:msg.receive_conv_key,conversation_key:conv_key };
        connection.query('INSERT INTO messages SET ?', msgdata, (err, res) => {
          if(err) throw err;
        
          io.in(msg.receive_conv_key).emit('chitmaymay', msg);
        });
      }
      

       
      
    });
    
});
server.listen(port, () => {
  console.log('listening on *:' + port);
});