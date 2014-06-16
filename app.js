//Express is the web framework used
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var cors = require('cors');

//Import the file with sensitive account information
//This is external so it can be hosted on public repositories without malicious
//intent.
var secrets = require('./app/secrets.js');

//Mongoose is a MongoDB wrapper
var mongoose = require('mongoose');

//Google/twitter/fb auth
var passport = require('passport')
  , GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy;

//For retaining user authentication
passport.serializeUser(function(user, done) {
  done(null, user);
});

//Logging out
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

//Google account authentication
passport.use(new GoogleStrategy({
    clientID: secrets.google.client_id,
    clientSecret: secrets.google.client_secret,
    callbackURL: 'http://q-2048.herokuapp.com/auth/google/return'
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      //Set authentication type and return the user
      profile.authType = 'google';
      return done(null, profile);
    });
  }
));

//Twitter account authentication
passport.use(new TwitterStrategy({
    consumerKey: secrets.twitter.key,
    consumerSecret: secrets.twitter.secret,
    callbackURL: "http://q-2048.herokuapp.com/auth/twitter/return"
  },
  function(token, tokenSecret, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      //Set authentication type and return the user
      profile.authType = 'twitter';
      return done(null, profile);
    });
  }
));

//Facebook account authentication
passport.use(new FacebookStrategy({
    clientID: secrets.facebook.client_id,
    clientSecret: secrets.facebook.secret,
    callbackURL: "http://q-2048.herokuapp.com/auth/facebook/return"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      //Set authentication type and return the user
      profile.authType = 'facebook';
      return done(null, profile);
    });
  }
));

//Initialize the application
var app = express();

// all environments
app.set('ip', 'localhost');
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(function(req, res, next) {
res.header('Access-Control-Allow-Credentials', true);
res.header('Access-Control-Allow-Origin', req.headers.origin);
res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
if ('OPTIONS' == req.method) {
     res.send(200);
 } else {
     next();
 }
});
app.use(express.favicon());
app.use(express.logger());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//Serve the index page if user visits the root
app.get('/', routes.index);

//Google auth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                            'https://www.googleapis.com/auth/userinfo.email'] }),
  function(req, res){
    // The request will be redirected to Google for authentication, so this
    // function will not be called.
  });

app.get('/auth/google/return',
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

//Twitter auth
app.get('/auth/twitter',
  passport.authenticate('twitter'),
  function(req, res){
    // The request will be redirected to Twitter for authentication, so this
    // function will not be called.
  });

app.get('/auth/twitter/return',
  passport.authenticate('twitter', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

//Facebook auth
app.get('/auth/facebook',
  passport.authenticate('facebook'),
  function(req, res){
    // The request will be redirected to Facebook for authentication, so this
    // function will not be called.
  });

app.get('/auth/facebook/return',
  passport.authenticate('facebook', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

//Logout
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


//Initialize Database
var db = mongoose.createConnection('mongodb://'+secrets.mongo.user+':'+
         secrets.mongo.pass+'@oceanic.mongohq.com:10014/'+
         secrets.mongo.app);

//Users will be global, so we must declare it in the global context
var Users = null;

//Error logging if database fails to connect
db.on('error', console.error.bind(console, 'connection error:'));

//On database connection
db.on('connected', function () {
  console.log('MongoDB connected');

  //Initialize the Users schema
  require('./app/models/users.js');
  Users = db.model('Users');

  //Drop (clear) the Users database every time user restarts
  //(This is so users don't get stuck in the lobby)
  Users.collection.drop();
});

//Initialize server with app we made earlier
var server = http.createServer(app);

//Begin listening on given port (80 by default, 5000 for localhost)
server.listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

//Start input output service, socket.io is a handler for web sockets
var io = require("socket.io").listen(server);

//Set default timeouts and intervals for slower connections (aka school network)
io.set('heartbeat interval', 10);
io.set('heartbeat timeout', 25);
io.set('close timeout', 25);
io.set('polling duration', 8);

//Every time a user connects, this function will perform
io.sockets.on('connection', function(socket) {
  console.log('Hello connection!');
  socket.emit('connection success');
  //Once user has submitted a username
  socket.on('set username', function(data) {
    //Delete if already exists:
    var user_google_id = data.google_id;
    var user_username = data.username;
    Users.find({ google_id: user_google_id }, function (err, users) {
      if (err) return console.error(err);
      if(users.length > 0) {
        //Get socket id of the user that was challenged
        var sock_id = io.sockets.sockets[users[0]._id];
        //Let them know the challenger withdrew
        io.sockets.sockets[sock_id].emit('session complete');
      }
      Users.remove({ google_id: user_google_id }, function(err) {
        if (err) return handleError(err);
        //Create a new user with given username from client
        var user = new Users({
          username: user_username,
          google_id: user_google_id
        });

        //Give the socket object the ID so it is globally accessible
        socket.user_id = user._id;

        //Give the socket object the name too, just so we can access it from client
        socket.username = user_username;

        //Allow global access to each socket
        io.sockets.sockets[user._id] = socket.id;

        //Save the user to the DB
        user.save(function (err, users) {
          if (err) return console.error(err);
          //Get all current users
          Users.find({ inRoom: false }, function (err, users) {
            if (err) return console.error(err);
            //Ready the client for the lobby, also send them other users in lobby.
            socket.emit('lobby', {
              'user_id': socket.user_id,
              'users': users
            });
            socket.broadcast.emit('users', { 'users': users });
          });
        });
      });
    });
  });

  //If a game request is sent from client
  socket.on('challenge request', function(data) {
    //Get the socket and user id of user being challenged
    var sock_id = io.sockets.sockets[data.challengedUser_id];
    var user_id = socket.user_id;
    var username = socket.username;
    //Send a message to the user being challenged
    io.sockets.sockets[sock_id].emit('challenge receive', {
      'challengerUser_id': user_id,
      'challengerUser_name': username
    });
  });

  //If a challenge has been cancelled
  socket.on('challenge cancel', function(data) {
    //Get socket id of the user that was challenged
    var sock_id = io.sockets.sockets[data.challengedUser_id];
    //Let them know the challenger withdrew
    io.sockets.sockets[sock_id].emit('challenge cancel');
  });

  //If a challenge has been rejected
  socket.on('challenge reject', function(data) {
    //Get the socket id of the user that initiated the challenge
    var sock_id = io.sockets.sockets[data.challengerUser_id];
    //Let them know the challenged user rejected.
    io.sockets.sockets[sock_id].emit('challenge reject');
  });

  //If a challenge has been accepted
  socket.on('challenge accept', function(data) {
    //Generate a unique room name for the two opponents
    var room_name = data.challengerUser_id + " " + socket.user_id;

    var sock_id = io.sockets.sockets[data.challengerUser_id];
    io.sockets.sockets[sock_id].join(room_name);
    Users.update({ _id: data.challengerUser_id }, { $set: {
      inRoom: true,
      'room_name': room_name
    }}, function() {
      //Get all current users
      Users.find({ inRoom: false }, function (err, users) {
        if (err) return console.error(err);
        //Update users for all clients
        io.sockets.emit('users', { 'users': users });
      });
    });
    Users.update({ _id: socket.user_id }, { $set: {
      inRoom: true,
      'room_name': room_name
    }}, function() {
      //Get all current users
      Users.find({ inRoom: false }, function (err, users) {
        if (err) return console.error(err);
        //Update users for all clients
        io.sockets.emit('users', { 'users': users });
      });
    });
    socket.join(room_name);
    io.sockets.in(room_name).emit('challenge accept');
  });

  socket.on('update game', function(data) {
    new_data = data;
    Users.find({ _id: data.user_id }, function (err, users) {
      if (err) return console.error(err);
      io.sockets.in(users[0].room_name).emit('update game', new_data);
    });
  });

  socket.on('game over', function(data) {
    var int_finalScore = data.score;
    Users.find({ _id: socket.user_id }, function (err, users) {
      if (err) return console.error(err);
      io.sockets.in(users[0].room_name).emit('game over', {
        'user_id': users[0]._id,
        'score': int_finalScore
      });
    });
  });

  socket.on('return to lobby', function(data) {
    Users.update({ _id: data.user_id }, { $set: {
      inRoom: false,
      'room_name': ''
    }}, function() {
      //Send socket
      var sock_id = io.sockets.sockets[socket.user_id];
      io.sockets.sockets[sock_id].emit('return to lobby');
      //Get all current users
      Users.find({ inRoom: false }, function (err, users) {
        if (err) return console.error(err);
        //Update users for all clients
        io.sockets.emit('users', { 'users': users });
      });
    });
  });

  socket.on('return to lobby', function(data) {
    Users.find({ _id: data.user_id }, function (err, users) {
      if (err) return console.error(err);
      if(users.length > 0) {
        if(users[0].room_name != '') {
          socket.leave(users[0].room_name);
        }
        Users.update({ _id: users[0]._id }, { $set: {
          inRoom: false,
          'room_name': ''
        }}, function() {
          //Send socket
          var sock_id = io.sockets.sockets[socket.user_id];
          io.sockets.sockets[sock_id].emit('return to lobby');
          //Get all current users
          Users.find({ inRoom: false }, function (err, users) {
            if (err) return console.error(err);
            //Update users for all clients
            io.sockets.emit('users', { 'users': users });
          });
        });
      }
    });
  });

  socket.on('disconnect', function() {
    Users.find({ _id: socket.user_id }, function (err, users) {
      if (err) return console.error(err);
      if(users.length > 0) {
        if(users[0].inRoom) {
          io.sockets.in(users[0].room_name).emit('opponent disconnect', users[0]);
        }
        //Remove user
        Users.remove({ _id: socket.user_id }, function (err) {
          if (err) return handleError(err);
          //Get all current users
          Users.find({ inRoom: false }, function (err, users) {
            if (err) return console.error(err);
            //Update users for all clients
            io.sockets.emit('users', { 'users': users });
          });

        });
      }
    });
  });

});
