// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = 4050
server.listen(port, function () {
	console.log(`Server listening at port ${port}`);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

// Chatroom

// 在线人数
var numUsers = 0;

// 监听客户端 socket 连接请求
io.on('connection', function (socket) {
	console.log('a user connection');
	// 判断当前用户是否已经登录过标志变量
	var addedUser = false;

	// 监听客户端发送信息请求
	socket.on('new message', function (data) {
		// we tell the client to execute 'new message'
		socket.broadcast.emit('new message', {
			username: socket.username,
			message: data
		});
	});

	// 监听客户端的登录请求
	socket.on('add user', function (username) {
		console.log(`User: ${username} is login`);

		if (addedUser) return;

		// we store the username in the socket session for this client
		socket.username = username;
		++numUsers;
		addedUser = true;
		// 登录回调
		socket.emit('login', {
			numUsers: numUsers
		});

		// 用户上线广播
		socket.broadcast.emit('user joined', {
			username: socket.username,
			numUsers: numUsers
		});
	});

	//
	socket.on('typing', function () {
		socket.broadcast.emit('typing', {
			username: socket.username
		});
	});

	//
	socket.on('stop typing', function () {
		socket.broadcast.emit('stop typing', {
			username: socket.username
		});
	});

	// 监听客户端断线
	socket.on('disconnect', function () {
		console.log(`User: ${socket.username} is logout`);
		if (addedUser) {
			--numUsers;

			// 用户下线广播
			socket.broadcast.emit('user left', {
				username: socket.username,
				numUsers: numUsers
			});
		}
	});
});

module.exports = app;
