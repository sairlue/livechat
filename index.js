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
app.get('/enduser', (req, res) => {
  res.sendFile(__dirname + '/enduser.html');
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
      
      
     
      if(msg.chat_type == 'group'){
        const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,group_id:msg.receive_id };
        connection.query('INSERT INTO message_groups SET ?', msgdata, (err, res) => {
          if(err) throw err;
        
          io.in(msg.receive_conv_key).emit('chitmaymay', msg);
        });
        const query = 'UPDATE `groups` '+
                  'SET `last_message` = ?, `last_time` = ? ' +
                  'WHERE `id` = ?';
        const values = [msg.message, msg.created_at, msg.receive_id];

        connection.query(query, values, (error, result) => {  // sends queries
                                        // closes connection
            if (error) throw error;
              // UPDATE `users` 
        });  
        
      }else{
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
           conv_key = key;
          connection.query('INSERT INTO chat_conversations SET ?', conv, (err, res) => {
            if(err) throw err;
          
            
          });
        }
        const query = 'UPDATE `chat_conversations` '+
                  'SET `last_message` = ?, `last_time` = ? ' +
                  'WHERE `conv_key` = ?';
        const values = [msg.message, msg.created_at, conv_key];

        connection.query(query, values, (error, result) => {  // sends queries
                                        // closes connection
            if (error) throw error;
              // UPDATE `users` 
        });  

        const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,receive_id:msg.receive_id,conversation_key:conv_key };
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