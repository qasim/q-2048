DIRECTION = {
  left: 1,
  right: 2,
  up: 3,
  down: 4
}

function Game(game_id, socket, user_id) {
  this.int_score = 0;
  this.grid = null;
  this.merge_grid = null;
  this.merged = [];
  this.bool_movement = false;
  this.socket = socket;
  this.user_id = user_id;
  this.game_id = game_id;
  this.full = false;

  $(game_id + ' .tile-container').html('');
  $('.opponent .tile-container').html('');
}

Game.prototype.start = function() {
  this.grid = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];

  this.spawnTile();
  this.spawnTile();
}

Game.prototype.spawnTile = function () {
  console.log('Spawning tile');
  var arr_openCells = [];
  for(var x = 0; x < 4; x++) {
    for(var y = 0; y < 4; y++) {
      if(this.grid[x][y] == 0) {
        arr_openCells.push([x, y]);
      }
    }
  }
  if(arr_openCells.length > 0) {
    this.full = false;
    var arr_cell = arr_openCells[Math.floor(Math.random()*arr_openCells.length)];
    this.createTile(arr_cell[0], arr_cell[1]);
  } else {
    this.full = true;
  }
}

Game.prototype.createTile = function(int_x, int_y, int_value) {
  int_value = int_value || ((Math.random() > 0.9) ? 4 : 2);
  this.grid[int_x][int_y] = int_value;
  var tile = $('<div class="tile tile-'+int_value+'\
  tile-position-'+int_x+'-'+int_y+'">'+int_value+'</div>');
  $(this.game_id + ' .tile-container').append(tile);
  tile.show();
  var html = $(this.game_id + ' .tile-container').html();
  this.socket.emit('update game', {
    'user_id': this.user_id,
    'score': this.int_score,
    'html': html
  });
}

Game.prototype.updateScore = function() {
  $('.local .player-score').html(this.int_score);
}

Game.prototype.clearMergeGrid = function() {
  this.merge_grid = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
}

Game.prototype.addMergedTile = function(int_x, int_y) {
  this.merge_grid[int_x][int_y] = 1;
}

Game.prototype.alreadyMerged = function(int_x, int_y) {
  if(this.merge_grid[int_x][int_y] == 1) {
    return true;
  }
  return false;
}

Game.prototype.move = function(direction, bool_merge) {
  if(!bool_merge) {
    this.clearMergeGrid();
  }
  //Holds all the moves to be performed
  var arr_moves = [];

  if(direction == DIRECTION.left) {
    var int_maxX = 0;
  } else if(direction == DIRECTION.right) {
    var int_maxX = 3;
  }

    if(direction == DIRECTION.up) {
    var int_maxY = 0;
  } else if(direction == DIRECTION.down) {
    var int_maxY = 3;
  }

  //Loop through every tile
  for(var y = 0; y < 4; y++) {
    for(var x = 0; x < 4; x++) {
      this.fixTile(x, y);
      //If the tile exists and the location isnt already all the way to the left
      if(direction == DIRECTION.left || direction == DIRECTION.right) {
        if(this.grid[x][y] != 0 && x != int_maxX) {
          var bool_validMove = false;
          //Loop until the end of the board
          if(direction == DIRECTION.left) {
            for(var newX = x - 1; newX >= 0; newX--) {
              //If we are in the loop, a move is possible
              bool_validMove = true;
              //Check if tile is empty
              if(this.grid[newX][y] == 0) {
                //Keep going left
                continue;
              } else {
                //Stop going left, we hit something.
                newX++;
                break;
              }
            }
            newX = (newX >= 0) ? newX : 0;
          } else if(direction == DIRECTION.right) {
            for(var newX = x + 1; newX <= 3; newX++) {
              //If we are in the loop, a move is possible
              bool_validMove = true;
              //Check if tile is empty
              if(this.grid[newX][y] == 0) {
                //Keep going left
                continue;
              } else {
                //Stop going left, we hit something.
                newX--;
                break;
              }
            }
            newX = (newX <= 3) ? newX : 3;
          }
          if(bool_validMove) {
            if(x != newX) {
              arr_moves.push([x, y, newX, y]);
              this.bool_movement = true;
            }
          }
        }
      } else {
        if(this.grid[x][y] != 0 && y != int_maxY) {
          var bool_validMove = false;
          //Loop until the end of the board
          if(direction == DIRECTION.up) {
            for(var newY = y - 1; newY >= 0; newY--) {
              //If we are in the loop, a move is possible
              bool_validMove = true;
              //Check if tile is empty
              if(this.grid[x][newY] == 0) {
                //Keep going left
                continue;
              } else {
                //Stop going left, we hit something.
                newY++;
                break;
              }
            }
            newY = (newY >= 0) ? newY : 0;
          } else if(direction == DIRECTION.down) {
            for(var newY = y + 1; newY <= 3; newY++) {
              //If we are in the loop, a move is possible
              bool_validMove = true;
              //Check if tile is empty
              if(this.grid[x][newY] == 0) {
                //Keep going left
                continue;
              } else {
                //Stop going left, we hit something.
                newY--;
                break;
              }
            }
            newY = (newY <= 3) ? newY : 3;
          }
          if(bool_validMove) {
            if(y != newY) {
              arr_moves.push([x, y, x, newY]);
              this.bool_movement = true;
            }
          }
        }
      }
    }
  }
  //For each of the moves
  for(var i = 0; i < arr_moves.length; i++) {
    //Fix the grid array appropriate for each move
    this.grid[arr_moves[i][2]][arr_moves[i][3]] = this.grid[arr_moves[i][0]][arr_moves[i][1]];
    this.grid[arr_moves[i][0]][arr_moves[i][1]] = 0;
    //Physically (in the document) change the tile's location
    this.moveTile(arr_moves[i][0], arr_moves[i][1], arr_moves[i][2], arr_moves[i][3]);
  }
  if(arr_moves.length > 0) {
    //Recursion, keep iterating over this function until no more moves
    if(bool_merge) {
      this.move(direction, true);
    } else {
      this.move(direction, false);
    }
  } else {
    if(bool_merge != true) {
      var int_xChange = 0;
      var int_yChange = 0;
      if(direction == DIRECTION.left) {
        int_xChange = -1;
      } else if(direction == DIRECTION.right) {
        int_xChange = 1;
      }
      if(direction == DIRECTION.up) {
        int_yChange = -1;
      } else if(direction == DIRECTION.down) {
        int_yChange = 1;
      }
      for(var y = 0; y < 4; y++) {
        for(var x = 0; x < 4; x++) {
          if(int_xChange != 0) {
            if(this.grid[x][y] != 0 && x != int_maxX) {
              if(this.grid[x+int_xChange][y] == this.grid[x][y]) {
                if(!this.alreadyMerged(x+int_xChange, y) && !this.alreadyMerged(x, y)) {
                  this.mergeTiles(x+int_xChange, y, x, y);
                  this.addMergedTile(x+int_xChange, y);
                  this.addMergedTile(x, y);
                  this.bool_movement = true;
                }
              }
            }
          } else {
            if(this.grid[x][y] != 0 && y != int_maxY) {
              if(this.grid[x][y+int_yChange] == this.grid[x][y]) {
                if(!this.alreadyMerged(x, y+int_yChange) && !this.alreadyMerged(x, y)) {
                  this.mergeTiles(x, y+int_yChange, x, y);
                  this.addMergedTile(x, y+int_yChange);
                  this.addMergedTile(x, y);
                  this.bool_movement = true;
                }
              }
            }
          }
        }
      }
      this.move(direction, true);
    } else {
      if(this.bool_movement) {
        this.bool_movement = false;
        this.spawnTile();
      }
      this.full = true;
      for(var x = 0; x < 4; x++) {
        for(var y = 0; y < 4; y++) {
          if(this.grid[x][y] == 0) {
            this.full = false;
          }
        }
      }
      if(this.full && !this.movesAvailable()) {
        this.finish();
      }
    }
  }
}

Game.prototype.movesAvailable = function() {
  for(var x = 0; x < 4; x++) {
    for(var y = 0; y < 4; y++) {
      if(this.grid[x][y] != 0 && x >= 1 && y >= 1) {
        if(this.grid[x][y] == this.grid[x-1][y] || this.grid[x][y] == this.grid[x][y-1]) {
          //Moves are possible
          return true;
        }
      }
    }
  }
  for(var x = 3; x >= 0; x--) {
    for(var y = 3; y >= 0; y--) {
      if(this.grid[x][y] != 0 && x <= 2 && y <= 2) {2
        if(this.grid[x][y] == this.grid[x+1][y] || this.grid[x][y] == this.grid[x][y+1]) {
          //Moves are possible
          return true;
        }
      }
    }
  }
  return false;
}

Game.prototype.mergeTiles = function(int_x, int_y, int_toMergeX, int_toMergeY) {
  this.grid[int_x][int_y] = this.grid[int_toMergeX][int_toMergeY] * 2;
  this.int_score += this.grid[int_toMergeX][int_toMergeY] * 2;
  this.updateScore();
  this.removeTile(int_x, int_y);
  this.moveTile(int_toMergeX, int_toMergeY, int_x, int_y, this.grid[int_toMergeX][int_toMergeY] * 2);
  this.grid[int_toMergeX][int_toMergeY] = 0;
}

Game.prototype.removeTile = function(int_x, int_y) {
  var tile = $(this.game_id + ' .tile.tile-position-'+int_x+'-'+int_y);
  tile.remove();
}

Game.prototype.moveTile = function(int_oldX, int_oldY, int_newX, int_newY, int_newVal) {
  var tile = $(this.game_id + ' .tile.tile-position-'+int_oldX+'-'+int_oldY);
  if(int_newVal) {
    tile.addClass('tile-' + int_newVal);
    tile.html(int_newVal);
    tile.removeClass('tile-' + (int_newVal / 2));
    //tile.removeClass('pulse').addClass('pulse');
  }
  tile.removeClass('tile-position-'+int_oldX+'-'+int_oldY);
  tile.addClass('tile-position-'+int_newX+'-'+int_newY);
  tile.addClass('tile-position-'+int_newX+'-'+int_newY);
}

Game.prototype.fixTile = function(int_x, int_y) {
  /*var tile = $(this.game_id + ' .tile.tile-position-'+int_x+'-'+int_y);
  for(var i = 1; i <= 11; i++) {
    tile.removeClass('tile-'+Math.pow(2, i));
  }
  tile.addClass('tile-'+this.grid[int_x][int_y]);
  tile.html(this.grid[int_x][int_y]);*/
}

Game.prototype.finish = function() {
  window.gameOver = true;
  var int_finalScore = this.int_score;
  window.finalScore = this.int_score;
  this.socket.emit('game over', { 'score': int_finalScore });
  window.localGame = null;
}
