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
// connection.query('SELECT * FROM customers', (err,rows) => {
//   if(err) throw err;

//   console.log('Data received from Db:');
//   console.log(rows);
// });



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

const isValidJwt = (header) => {
  const check_token = process.env.AUTH_TOKEN;
  const token = header;
  if (token === check_token) {
    
    return true;
    
  } else {
    
    return false;
  }
};

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (isValidJwt(token)) {
    
    return next();
  }
  return next(new Error('authentication error'));
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
      
      if(msg.chat_type == 'group'){ //chat by group
        const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,group_id:msg.receive_id,reply_message:msg.reply_messageid };
       
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
       
        
      }else{ // chat by user one by one
        let conv_key = "";
        if(msg.conversation_key){
          conv_key = msg.conversation_key;
          
          const query = 'UPDATE `chat_conversations` '+
          'SET `last_message` = ?, `last_time` = ? ' +
          'WHERE `conv_key` = ?';
          const values = [msg.message, msg.created_at, conv_key];
          //update chat conversation key
          connection.query(query, values, (error, result) => {  // sends queries
                                          // closes connection
              if (error) throw error;
                // UPDATE `users` 
          });  

           //create unread msg 
        const checkQuery = "SELECT `unread_count` FROM message_customer_reads WHERE `conv_key` = ? AND `user_id` = ?";
        const checkV = [conv_key,msg.receive_id];
        connection.query(checkQuery,checkV, (err, res) => {
            if(err) throw err;
            if(res.length == 0){
              const unreadData = { user_id: msg.receive_id, conv_key:conv_key,chat_type:msg.chat_type,unread_count:0 };
              connection.query('INSERT INTO message_customer_reads SET ?', unreadData, (err, res) => {
                if(err) throw err;
                
                
              });
            }
        });
        //add msg 
          const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,receive_id:msg.receive_id,conversation_key:conv_key };
        connection.query('INSERT INTO messages SET ?', msgdata, (err, res) => {
          if(err) throw err;
        
          io.in(msg.receive_conv_key).emit('chitmaymay', msg);
        });
        }else{
          var min = 100000000;
          var max = 999999999;
          var rmint =  Math.floor(Math.random() * (max - min)) + min;
          let key = "CHAT_" + rmint;
          
           conv_key = key;
           //check has or not conversation key
           const checkQuery = "SELECT * FROM chat_conversations WHERE `start_user` = ? AND `end_user` = ?";
        const checkV = [msg.sender_id,msg.receive_id];
        connection.query(checkQuery,checkV, (err, res) => {
            if(err) throw err;
            
            if(res.length > 0){
              let startMsg = {
                message:msg.message,
                message_type:msg.message_type,
                chat_type:msg.chat_type,
                reply_messageid:msg.reply_messageid,
                reply_message:msg.reply_message,
                sender_id:msg.sender_id,
                sender_name:msg.sender_name,
                sender_img:msg.sender_img,
                sender_conv_key:msg.sender_conv_key,
                receive_id:msg.receive_id,
                receive_name:msg.receive_name,
                receive_conv_key:msg.receive_conv_key,
                conversation_key:res[0].conv_key,
                created_at:msg.created_at
              }
              const query = 'UPDATE `chat_conversations` '+
              'SET `last_message` = ?, `last_time` = ? ' +
                        'WHERE `start_user` = ? AND `end_user` = ?';
              const values = [msg.message, msg.created_at,msg.sender_id,msg.receive_id];
              //update chat conversation key
              connection.query(query, values, (error, result) => {  // sends queries
                                              // closes connection
                  if (error) throw error;
                    // UPDATE `users` 
              });  

               //create unread msg 
               let unreadConv_key = res[0].conv_key;
        const checkQuery = "SELECT `unread_count` FROM message_customer_reads WHERE `conv_key` = ? AND `user_id` = ?";
        const checkV = [unreadConv_key,msg.receive_id];
        connection.query(checkQuery,checkV, (err, res) => {
            if(err) throw err;
            if(res.length == 0){
              
              const unreadData = { user_id: msg.receive_id, conv_key:unreadConv_key,chat_type:msg.chat_type,unread_count:0 };
              connection.query('INSERT INTO message_customer_reads SET ?', unreadData, (err, res) => {
                if(err) throw err;
                
                
              });
            }
        });

              const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,receive_id:msg.receive_id,conversation_key:res[0].conv_key };
              connection.query('INSERT INTO messages SET ?', msgdata, (err, res) => {
                if(err) throw err;
              
                io.in(msg.receive_conv_key).emit('chitmaymay', startMsg);
              });

            }else{
              let startMsg = {
                message:msg.message,
                message_type:msg.message_type,
                chat_type:msg.chat_type,
                reply_messageid:msg.reply_messageid,
                reply_message:msg.reply_message,
                sender_id:msg.sender_id,
                sender_name:msg.sender_name,
                sender_img:msg.sender_img,
                sender_conv_key:msg.sender_conv_key,
                receive_id:msg.receive_id,
                receive_name:msg.receive_name,
                receive_conv_key:msg.receive_conv_key,
                conversation_key:conv_key,
                created_at:msg.created_at
              }
              var conv = {
                start_user:msg.sender_id,end_user:msg.receive_id,conv_key:key,last_message:msg.message,last_time:msg.created_at
              };
               //insert conversation key
              connection.query('INSERT INTO chat_conversations SET ?', conv, (err, res) => {
                if(err) throw err;
              
                
              });
               //create unread msg 
        const checkQuery = "SELECT `unread_count` FROM message_customer_reads WHERE `conv_key` = ? AND `user_id` = ?";
        const checkV = [conv_key,msg.receive_id];
        connection.query(checkQuery,checkV, (err, res) => {
            if(err) throw err;
            if(res.length == 0){
              const unreadData = { user_id: msg.receive_id, conv_key:conv_key,chat_type:msg.chat_type,unread_count:0 };
              connection.query('INSERT INTO message_customer_reads SET ?', unreadData, (err, res) => {
                if(err) throw err;
                
                
              });
            }
        });
              const msgdata = { message: msg.message, message_type:msg.message_type,sender_id:msg.sender_id,receive_id:msg.receive_id,conversation_key:conv_key };
              connection.query('INSERT INTO messages SET ?', msgdata, (err, res) => {
                if(err) throw err;
              
                io.in(msg.receive_conv_key).emit('chitmaymay', startMsg);
              });
            }
        });
          
        }
       
       
        // insert send message data
        
      }
      

       
      
    });

    data.on('chitmaymay.unread',(msg)=>{ //for unread message count
        var conv_key="";
        if(msg.chat_type == "user"){ //add unread count to table

            conv_key = msg.conv_key;
        
        
          const checkQuery = "SELECT `unread_count` FROM message_customer_reads WHERE `conv_key` = ? AND `user_id` = ?";
          const checkV = [conv_key,msg.receive_id];
          connection.query(checkQuery,checkV, (err, res) => {
              if(err) throw err;
             
              if(res.length > 0){ //insert start unread count
                var unread = res[0].unread_count;
                unread += 1;
                const query = 'UPDATE `message_customer_reads` '+
                  'SET `unread_count` = ? ' +
                  'WHERE `user_id` = ? AND `conv_key` = ?';

                const values = [unread, msg.receive_id, conv_key];

                connection.query(query, values, (error, result) => {  // sends queries
                                                // closes connection
                    if (error) throw error;
                    
                }); 
              }
            
          }); 
        }else{
          
          if(msg.is_admin){ //add unread count for admin panel
            const checkQuery = "SELECT * FROM group_members WHERE `group_id` = ? AND `is_admin` = ?";
            const checkV = [msg.group_id,msg.is_admin];
            connection.query(checkQuery,checkV, (err, res) => {
                if(err) throw err;
                
                if(res.length > 0){ //insert start unread count
                  var unread = res[0].unread_count;
                  unread += 1;
                 
                  const query = 'UPDATE `group_members` '+
                    'SET `unread_count` = ? ' +
                    'WHERE `group_id` = ? AND `member_id` = ?';
  
                  const values = [unread, res[0].group_id, res[0].member_id];
  
                  connection.query(query, values, (error, result) => {  // sends queries
                                                  // closes connection
                      if (error) throw error;
                      
                      //console.log(result);
                  }); 
                }
              
            });
          }else{  // add unread count group msg for user
            const checkQuery = "SELECT * FROM group_members WHERE `group_id` = ? AND `member_id` = ?";
            const checkV = [msg.group_id,msg.sender_id];
            connection.query(checkQuery,checkV, (err, res) => {
                if(err) throw err;
               
                if(res.length > 0){ //insert start unread count
                  var unread = res[0].unread_count;
                  unread += 1;
                  const query = 'UPDATE `group_members` '+
                    'SET `unread_count` = ? ' +
                    'WHERE `group_id` = ? AND `member_id` = ?';
                  
                  const values = [unread, res[0].group_id, res[0].member_id];
  
                  connection.query(query, values, (error, result) => {  // sends queries
                                                  // closes connection
                      if (error) throw error;
                     // console.log(result);
                  }); 
                }
              
            });
          }
           
        }
    });
    
    data.on('chitmaymay.read',(msg)=>{ // for read msg
        if(msg.chat_type == 'group'){

          const query = 'UPDATE `group_members` '+
                    'SET `unread_count` = ? ' +
                    'WHERE `group_id` = ? AND `member_id` = ?';
          let unread = 0;
          const values = [unread, msg.group_id, msg.sender_id];
          //console.log(msg);
          connection.query(query, values, (error, result) => {  // sends queries
            if (error) throw error;
            //console.log(result);
          });  
        }else{
          const query = 'UPDATE `message_customer_reads` '+
          'SET `unread_count` = ? ' +
          'WHERE `user_id` = ? AND `conv_key` = ?';
          let unread = 0;
          const values = [unread, msg.sender_id, msg.conv_key];
          //console.log(msg);
          connection.query(query, values, (error, result) => {  // sends queries
            if (error) throw error;
            //console.log(result);
          });  
        }
    });
});
server.listen(port, () => {
  console.log('listening on *:' + port);
});