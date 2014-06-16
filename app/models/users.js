var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
  username: String,
  google_id: String,
  inRoom: { type: Boolean, default: false },
  room_name: { type: String, default: '' }
});

var model = mongoose.model('Users', UserSchema);
module.exports = model;
