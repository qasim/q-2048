
/*
 * GET home page.
 */

exports.index = function(req, res){
  req.userJSON = JSON.stringify(req.user);
  if(req.userJSON == undefined) {
    req.userJSON = '""';
  }
  res.render('index', { title: 'Q-2048 Multiplayer', user: req.userJSON });
};
