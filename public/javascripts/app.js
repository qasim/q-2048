$(document).ready(function() {
  if(jQuery.browser.mobile) {
    $('.mobile-user').show();
    return;
  }

  var socket = io.connect(location.href);

  window.finished = false;

  if(!cookieHandler.hasItem('user_id')) {
    cookieHandler.setItem("user_id", guid(), Infinity);
  }
  window._user_id = cookieHandler.getItem('user_id');

  socket.on('connection success', function() {
    $('#username').keyup(function (event) {
      if (event.keyCode == 13) {
        //The user pressed enter
        var str_username = $('#username').val();
        if (str_username.match(/^[0-9a-z]+$/)) {
          window.username = $('#username').val();
          window.identifier = window._user_id;
          $('#username').prop('disabled', true);
          document.title = "Connecting...";
          socket.emit('set username', {
            'username': window.username,
            'google_id': window.identifier
          });
        }
      }
    });
    $('#go').click(function () {
      //The user hit the button
      var str_username = $('#username').val();
      if (str_username.match(/^[0-9a-z]+$/)) {
        window.username = $('#username').val();
        window.identifier = window._user_id;
        $('#username').prop('disabled', true);
        document.title = "Connecting...";
        socket.emit('set username', {
          'username': window.username,
          'google_id': window.identifier
        });
      }
    });
    if(window.user != "") {
      $('.username-prompt').fadeIn('fast');
      var new_username = "";
      var new_id = "";
      if(window.user.authType == 'twitter') {
        window.username = window.user.username;
        window.identifier = window.user.id;
      } else if(window.user.authType == 'google'){
        window.username = window.user.name.givenName + " " +
                       window.user.name.familyName;
        window.identifier = window.user.id;
      } else if(window.user.authType == 'facebook') {
        window.username = window.user.name.givenName + " " +
                       window.user.name.familyName;
        window.identifier = window.user.id;
      }
      $('.connecting').fadeIn('fast');
      document.title = "Connecting...";
      socket.emit('set username', {
        'username': window.username,
        'google_id': window.identifier
      });
    } else {
      $('.username-prompt').fadeIn('fast', function() {
        $('.sign-in').fadeIn('fast');
      });
    }
  });

  socket.on('session complete', function() {
    console.log('done');
    window.finished = true;
    socket.disconnect();
    socket = null;
    window.gameOver = true;
    $('.session-closed').fadeIn('fast');
  });

  socket.on('lobby', function (data) {
    document.title = window.username;
    $('.username-prompt').slideUp('fast', function() {
      $('.lobby .username').html(window.username);
      $('.lobby .users').html('');
      window.user_id = data.user_id;
      if(data.users.length == 1) {
        $('.lobby .users').html('<div class="nothing">No users are currently online.</div>');
      } else {
        for(var i = 0; i < data.users.length; i++) {
          if(data.users[i]._id != window.user_id) {
            $('.lobby .users').append('<div class="user" id="' +
            data.users[i]._id + '">' + data.users[i].username + '</div>');
          }
        }
      }
      $('.sign-in').fadeOut('fast');
      $('.lobby').fadeIn('fast');
    });
  });

  socket.on('users', function (data) {
    $('.lobby .users').html('');
    if(data.users.length == 1) {
      $('.lobby .users').html('<div class="nothing">No users are currently online.</div>');
    } else {
      for(var i = 0; i < data.users.length; i++) {
        if(data.users[i]._id != window.user_id) {
          $('.lobby .users').append('<div class="user" id="' + data.users[i]._id +
          '">' + data.users[i].username + '</div>');
        }
      }
    }
  });

  $(document).on('click', '.user', function() {
    var user_id = $(this).attr('id');
    var user_name = $(this).html();
    socket.emit('challenge request', { 'challengedUser_id': user_id });
    $('.challenge-waiting #challengedUser').html(user_name);
    window.opponent_username = user_name;
    $('.challenge-waiting #challengedUser_id').val(user_id);
    $('.challenge-waiting').fadeIn('fast');
  });

  $(document).on('click', '.challenge-waiting .button-cancel', function() {
    var user_id = $('.challenge-waiting #challengedUser_id').val();
    socket.emit('challenge cancel', { 'challengedUser_id': user_id });
    $('.challenge-waiting').fadeOut('fast');
  });

  socket.on('challenge receive', function(data) {
    $('.challenge-received #challengerUser').html(data.challengerUser_name);
    $('.challenge-received #challengerUser_id').val(data.challengerUser_id);
    window.opponent_username = data.challengerUser_name;
    $('.challenge-received').fadeIn('fast');
  });

  socket.on('challenge cancel', function() {
    $('.challenge-received').fadeOut('fast');
  });

  $(document).on('click', '.challenge-received .button-reject', function() {
    var user_id = $('.challenge-received #challengerUser_id').val();
    socket.emit('challenge reject', { 'challengerUser_id': user_id });
    $('.challenge-received').fadeOut('fast');
  });

  socket.on('challenge reject', function() {
    $('.challenge-waiting').fadeOut('fast');
  });

  $(document).on('click', '.challenge-received .button-accept', function() {
    var user_id = $('.challenge-received #challengerUser_id').val();
    socket.emit('challenge accept', { 'challengerUser_id': user_id });
    $('.challenge-received').fadeOut('fast');
    $('.lobby').fadeOut('fast');
  });

  $(document).keyup(function (event) {
    if(!window.gameOver && window.localGame != null) {
      if (event.keyCode == 37) {
        window.localGame.move(DIRECTION.left, false);
      } else if(event.keyCode == 39) {
        window.localGame.move(DIRECTION.right, false);
      } else if(event.keyCode == 38) {
        window.localGame.move(DIRECTION.up, false);
      } else if(event.keyCode == 40) {
        window.localGame.move(DIRECTION.down, false);
      }
    }
  });

  socket.on('challenge accept', function(data) {
    setDefaults();
    $('.challenge-waiting').fadeOut('fast');
    $('.lobby').fadeOut('fast');
    $('.local .player-name').html(window.username);
    $('.opponent .player-name').html(window.opponent_username);
    $('.game').fadeIn('fast');
    window.localGame = new Game('.local', socket, window.user_id);
    window.localGame.start();

    window.currentTime = window.gameTime;
    $('.time-box').html(moment().startOf('day')
                                .seconds(window.currentTime)
                                .format('m:ss'));

    window.timer = setInterval(function() {
      if(window.gameOver && window.finalScore >= 0 && window.opponent_finalScore >= 0) {
        clearInterval(window.timer);
        return;
      }
      if(window.currentTime == 0) {
        //Game over
        window.gameOver = true;
        window.localGame.finish();
        clearInterval(window.timer);
      } else {
        window.currentTime--;
        $('.time-box').html(moment().startOf('day')
                                    .seconds(window.currentTime)
                                    .format('m:ss'));
      }
    }, 1000);
  });

  socket.on('update game', function(data) {
    if(data.user_id != window.user_id) {
      $('.opponent .tile-container').html(data.html);
      $('.opponent .player-score').html(data.score);
    }
  });

  socket.on('game over', function(data) {
    console.log(data.user_id, window.user_id);
    if(data.user_id != window.user_id) {
      window.opponent_finalScore = data.score;
      window.timer_waitForFinish = setInterval(function() {
        if(window.opponent_finalScore >= 0 && window.finalScore >= 0) {
          //Game done, score received for both sides.
          if(window.finalScore > window.opponent_finalScore) {
            $('.game-over .title').html('You win!');
          } else if (window.finalScore < window.opponent_finalScore) {
            $('.game-over .title').html('You lose!');
          } else {
            $('.game-over .title').html('It\'s a tie!');
          }
          $('.game-over .local-score').html(window.finalScore);
          $('.game-over .opponent-score').html(window.opponent_finalScore);
          $('.game-over').fadeIn('fast');
          clearInterval(window.timer_waitForFinish);
        }
      }, 200);
    }
  });

  socket.on('opponent disconnect', function(data) {
    if(!window.gameOver) {
      $('.opponent-disconnected #opponent').html(data.username);
      $('.opponent-disconnected').fadeIn('fast');
      window.gameOver = true;
    }
  });

  $(document).on('click', '.button-return', function() {
    $('.game').fadeOut('fast');
    $('.opponent-disconnected').fadeOut('fast');
    $('.game-over').fadeOut('fast');
    socket.emit('return to lobby', { 'user_id': window.user_id });
  });

  socket.on('return to lobby', function() {
    $('.lobby').fadeIn('fast');
  });

  socket.on('disconnect', function() {
    if(!window.finished) {
      window.location.reload();
    }
  });

});

function setDefaults() {
  window.gameOver = false;
  window.gameTime = 180;
  window.currentTime = 0;
  window.opponent_finalScore = -1;
  window.finalScore = -1;
  window.localGame = null;
}
