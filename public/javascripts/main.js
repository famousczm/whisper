$(function() {
	const FADE_TIME = 150 // ms
	const TYPING_TIMER_LENGTH = 400 // ms
	const COLORS = [
		'#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
	]

	/** Initialize variables **/
	let $window = $(window)
	// Input for username
	let $usernameInput = $('.usernameInput')
	// Message area
	let $messages = $('.messages')
	// Input message input box
	let $inputMessage = $('.inputMessage')
	// Send message button
	let $add = $('#add')[0]
	$add.onclick = sendMessage

  // The login page
	let $loginPage = $('.login.page')
	// The chatroom page
	let $chatPage = $('.chat.page')

	/** Prompt for setting a username **/
	let username
	let connected = false
	let typing = false
	let lastTypingTime
	let $currentInput = $usernameInput.focus()

	let socket = io()

	function addParticipantsMessage (data) {
		if (!data) return

		let message = ''
		message = `目前聊天室有${data.numUsers}个人`
		log(message)
	}

  // 设置用户昵称
	function setUsername () {
		username = cleanInput($usernameInput.val().trim()).replace(/\s+/g, '')

	  // 关闭登录页，显示聊天页面
		if (username) {
			$loginPage.fadeOut()
			$chatPage.show()
			$loginPage.off('click')
			$currentInput = $inputMessage.focus()

			// 发送登录请求
			socket.emit('add user', username)
		}
	}

  // 发送一条消息
	function sendMessage () {
		let message = cleanInput($inputMessage.val())
		if (!message || message.replace(/\s+/g, '') === '') {
			$inputMessage.val('')
			return
		}
		// if there is a non-empty message and a socket connection
		if (message && connected) {
			$inputMessage.val('')
			addChatMessage({
				username: username,
				message: message
			})
			// 发送发送信息请求
			socket.emit('new message', message)
		}

		socket.emit('stop typing')
		typing = false
	}

	/**
	* 打印一个消息
	* @param data
	* @param options
	*/
	function log (message, options) {
		if (!message) return
		let $el = $('<li>').addClass('log').text(message)
		addMessageElement($el, options)
	}

	/**
	* 增加一条聊天消息
	* @param data
	* @param options
	*/
	function addChatMessage (data, options) {
		if (!data) return
		// Don't fade the message in if there is an 'X was typing'
		let $typingMessages = getTypingMessages(data)
		options = options || {}
		if ($typingMessages.length !== 0) {
			options.fade = false
			$typingMessages.remove()
		}

		let $usernameDiv = $('<span class="username">')
		  .text(data.username)
			.css('color', getUsernameColor(data.username))

		let $messageBodyDiv = $('<span class="messageBody">')
		  .text(data.message)

		let typingClass = data.typing ? 'typing' : ''
		let $messageDiv = $('<li class="message"/>')
		  .data('username', data.username)
			.addClass(typingClass)
			.append($usernameDiv, $messageBodyDiv)

		addMessageElement($messageDiv, options)
	}

	/**
	* 增加一条正在输入的信息
	* @param data
	*/
  function addChatTyping (data) {
		if (!data) return
		data.typing = true
		data.message = '正在输入...'
		addChatMessage(data)
	}

  /**
	* 移除正在输入的消息
	* @param data
	*/
	function removeChatTyping(data) {
		if (!data) return
		getTypingMessages(data).fadeOut(function () {
			$(this).remove()
		})
	}

	/**
	* 增加一条消息在屏幕上
	* @param el - 新增的消息元素
	* @param options - 配置参数，可选
	*        options.fade - 元素是否要有隐现效果，默认 true
	*        options.prepend - 元素应该放置在所以消息之前，默认 false
	*/
	function addMessageElement (el, options) {
		if (!el) return
		var $el = $(el)

		// Setup default options
		if (!options) {
			options = {}
		}
		if (typeof options.fade === 'undefined') {
			options.fade = true
		}
		if (typeof options.prepend === 'undefined') {
			options.prepend = false
		}

		// Apply options
		if (options.fade) {
			$el.hide().fadeIn(FADE_TIME)
		}
		if (options.prepend) {
			$messages.prepend($el)
		} else {
			$messages.append($el)
		}
		$messages[0].scrollTop = $messages[0].scrollHeight
	}

	/**
	* 过滤输入内容，防止输入注入标记
	* @param input
	*/
	function cleanInput (input) {
		if (!input) return
		return $('<div/>').text(input).html()
	}

	/**
	* 更新正在输入事件
	*/
	function updateTyping () {
		if (connected) {
			if (!typing) {
				typing = true
				socket.emit('typing')
			}
			lastTypingTime = (new Date()).getTime()

      // 设置定时器来判断是否在连续输入中
			setTimeout(function () {
				let typingTimer = (new Date()).getTime()
				let timeDiff = typingTimer - lastTypingTime
				if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
					socket.emit('stop typing')
					typing = false
				}
			}, TYPING_TIMER_LENGTH)
		}
	}

	/**
	* 获得 'X 正在输入' 的信息
	* @param data
	*/
	function getTypingMessages (data) {
		if (!data) return
		return $('.typing.message').filter(function (i) {
			return $(this).data('username') === data.username
		})
	}

	/**
	* 根据用户名通过特定算法获得颜色
	* @param username
	* @return {String}
	*/
  function getUsernameColor (username) {
		if (!username) return
		// Compute hash code
		let hash = 7
		for (let i = 0, len = username.length; i < len; i++) {
			hash = username.charCodeAt(i) + (hash << 5) - hash
		}

		// Calculate color
		let index = Math.abs(hash % COLORS.length)
		return COLORS[index]
	}

	// Keyboard.keydown

	$window.keydown(function (event) {
		// 当按下除了 ctrl meta alt 这几个键的任意键时自动对焦当前的输入框
		if (!(event.ctrlKey || event.metaKey || event.altKey)) {
			$currentInput.focus()
		}

		// 按下 ENTER 键，如果用户名存在则发送信息，否则进行登录操作
		if (event.which === 13) {
			if (username) {
				sendMessage()
			} else {
				setUsername()
			}
		}
	})

  // 监听输入框的输入操作
	$inputMessage.on('input', function () {
		updateTyping()
	})

	// Click events

	// 点击登录页面自动对焦输入框
	$loginPage.click(function () {
		$currentInput.focus()
	})

	// 点击消息输入框对焦输入框
	$inputMessage.click(function () {
		$inputMessage.focus()
	})

	// Socket events

	// 监听 login 回调，并显示登录信息
	socket.on('login', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		connected = true
		// Display the welcome message
		let message = '欢迎来讲悄悄话，版本号 1.0.0'
		log(message, {
			prepend: true
		})
		addParticipantsMessage(data)
	})

	// 监听 new message 回调，更新聊天窗口内容
	socket.on('new message', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		addChatMessage(data)
	})

	// 监听 user joined 回调，并显示加入信息
	socket.on('user joined', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		log(data.username + ' 加入聊天')
		addParticipantsMessage(data)
	})

	// 监听 user left 回调，并显示离开信息
	socket.on('user left', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		log(data.username + ' 离开了')
		addParticipantsMessage(data)
		removeChatTyping(data)
	})

	// 监听 typing 回调，并显示输入信息
	socket.on('typing', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		addChatTyping(data)
	})

	// 监听 stop typing 回调，关闭显示信息
	socket.on('stop typing', function (data) {
		if (!data) {
			console.error('服务器错误')
			return
		}
		removeChatTyping(data)
	})

	socket.on('disconnect', function () {
		log('你已经断线了')
	})

	// socket.on('reconnect', function () {
	// 	log('你已经重连回来')
	// 	if (username) {
	// 		socket.emit('add user', username)
	// 	}
	// })
	//
	// socket.on('reconnect_error', function () {
	// 	log('重连失败')
	// })















});
