var chess = require( 'chess' );
var _ = require( 'lodash-node' );
var readline = require( 'readline' );
var Gitwar = require( 'gitwar' );
var colors = require( 'colors' );

var chessGame = chess.create();

var Gitchess = {};

Gitchess = {
    init: function() {
        Gitwar.init()
        .then( function() {
            return Gitchess.setState();
        })
        .then( function() {
            return Gitwar.head()
        })
        .then( function( head ) {
            if ( !Gitwar.me ) {
                print( 'userMissing' );
                process.exit();
            }

            print( 'board' );

            // Check for win
            if ( chessGame.getStatus().isCheckmate ) {
                if ( head.user == Gitwar.me ) {
                    print( 'youWin' );
                } else {
                    print( 'theyWin' );
                }
                process.exit();
            } else {
                if ( ( !head.user && Gitchess.myColor == 'black' ) || head.user == Gitwar.me ) {
                    return Gitchess.wait( true );
                } else {
                    return Gitchess.takeTurn( head );
                }
            }
        });
    },

    // This is the "view" layer. User-facing text. Static strings and functions
    // to build prompts/statements
    script: {
        turn: 'Your move: ',
        syntaxError: '\nMove not valid. Please try again.\n',
        userMissing: 'Your gitconfig username did not match any names in user.json. Game cannot start.',
        wrapUp: 'Wrapping up...',
        check: 'CHECK!',
        capture: function( turn ) {
            return Gitwar.opponent.red + ' captured your ' + turn.capture + '!';
        },
        wait: function() {
            return ( Gitwar.opponent + '\'s' ).opponentColor() + ' turn. Waiting...';
        },
        youWin: function() {
            return ( 'CHECKMATE! You win!' ).green + ' Congratulations. Reset game or branch to play again.';
        },
        theyWin: function() {
            return ( 'CHECKMATE! ' + Gitwar.opponent  + ' wins!' ).red + ' Sorry. Better luck next time.';
        },
        board: function() {
            // user reverse depending on player color
            var squares = chessGame.getStatus().board.squares;
            squares = Gitchess.myColor == 'white' ? _.extend( [], squares ).reverse() : squares;
            return _.reduce( squares, function( board, square, i ) {
                if ( i % 8 == 0 ) {
                    board += ( Math.floor( i / 8 ) + 1 ) + ' │';
                }
                var piece = square.piece;
                if ( piece ) {
                    var char = Gitchess.pieces[ piece.type ] || '';
                    board += ' ' + ( piece.side.name == 'white' ? char.red : char.cyan ) + '  │';
                } else {
                    board += '    │';
                }
                if ( i % 8 == 7 && i < 63 ) {
                    board += ' ' + ( Math.floor( i / 8 ) + 1 ) + boardLine;
                }
                if ( i == 63 ) {
                    board += boardTail;
                }
                return board;
            }, boardHead );
        }
    },

    // Catches state up according to git logs
    setState: function() {
        return Gitwar.logs()
        .then( function( commits ) {
            _.each( commits.reverse(), function( commit, i ) {
                if ( i == 1 ) {
                    if ( commit.user == Gitwar.me ) {
                        Gitchess.myColor = 'white';
                        Gitchess.opponentColor = 'black';
                    } else {
                        Gitchess.myColor = 'black';
                        Gitchess.opponentColor = 'white';
                    }
                }

                if ( commit.move ) {
                    // make sure white moves first
                    if ( i % 2 == 1 ) {
                        Gitchess.move( commit.move, true )
                    } else {
                        Gitchess.move( commit.move )
                    }
                }
            })

            if ( commits.length < 2 ) {
                if ( Gitwar.users[ 0 ] == Gitwar.me ) {
                    Gitchess.myColor = 'white';
                    Gitchess.opponentColor = 'black';
                } else {
                    Gitchess.myColor = 'black';
                    Gitchess.opponentColor = 'white';
                }
            }
        })
        .catch( function( err ) {
            console.log( err );
            process.exit();
        });
    },

    // Chess ASCII characters and alg notation lookup
    pieces: {
        pawn: '♟',
        bishop: '♝',
        knight: '♞',
        rook: '♜',
        queen: '♛',
        king: '♚',
        alg: {
            'bishop': 'B',
            'knight': 'N',
            'rook': 'R',
            'queen': 'Q',
            'king': 'K'
        }
    },

    // Lookup for flipping moves (node-chess only thinks of the board with
    // white on top)
    flip: {
        'a': 'h',
        'b': 'g',
        'c': 'f',
        'd': 'e',
        'e': 'd',
        'f': 'c',
        'g': 'b',
        'h': 'a',
        1: 8,
        2: 7,
        3: 6,
        4: 5,
        5: 4,
        6: 3,
        7: 2,
        8: 1,
    },

    // proxy for Gitwar.poll
    wait: function( first ) {
        print( 'wait' );

        if ( first ) {
            // If this is the very first step after init has been called we
            // don't want to call sync, because the head check will be out of
            // sync
            Gitwar.poll( Gitchess.takeTurn );
        } else {
            Gitwar.sync()
            .then( function() {
                return Gitwar.poll( Gitchess.takeTurn );
            });
        }
    },

    // Calculate alg notation for node-chess moves
    move: function( move, flip ) {
        var firstStr = move.substring( 0, 2 );
        var secondStr = move.substring( 2, 4 );
        var first;
        var second;
        var firstSide;

        // check for player color to see if flip
        var file = flip ? Gitchess.flip[ firstStr.charAt( 0 ) ] : firstStr.charAt( 0 );
        var rank = flip ? Gitchess.flip[ firstStr.charAt( 1 ) ] : firstStr.charAt( 1 );
        firstStr = file + rank;

        // check for player color to see if flip
        var file2 = flip ? Gitchess.flip[ secondStr.charAt( 0 ) ] : secondStr.charAt( 0 );
        var rank2 = flip ? Gitchess.flip[ secondStr.charAt( 1 ) ] : secondStr.charAt( 1 );
        secondStr = file2 + rank2;

        _.each( chessGame.getStatus().board.squares, function( square ) {
            if ( square.file == file && square.rank == rank ) {
                first = square.piece ? square.piece.type : null;
                firstSide = square.piece ? square.piece.side.name : null;
            }
            if ( square.file == file2 && square.rank == rank2 ) {
                second = square.piece ? square.piece.type : null;
            }
        });

        var sameFile = false;
        if ( first ) {
            _.each( chessGame.getStatus().board.squares, function( square ) {
                if ( square.piece && square.file == file && square.piece.type == first && firstSide == square.piece.side.name ) {
                    sameFile = true;
                    return false;
                }
            });
        }
        var modifier = ''//sameFile ? rank : file;

        // check first exists

        if ( second ) {
            var moveStr = ( first == 'pawn' ?
                file :
                Gitchess.pieces.alg[ first ] + modifier ) +
                'x' + secondStr;
        } else {
            var moveStr = ( first == 'pawn' ?
                        '' :
                        Gitchess.pieces.alg[ first ] + modifier ) +
                        secondStr;
        }

        // promoting pawns always to queen
        // TODO - prompt user for piece
        if ( ( rank2 == 8 || rank2 == 1 ) && first == 'pawn' ) {
            moveStr += '=Q';
        }

        var obj = { capture: second };

        try {
            chessGame.move( moveStr );
        } catch ( e ) {
            obj.error = true;
        }

        return obj;
    },

    takeTurn: function( lastTurn ) {
        if ( lastTurn ) {
            Gitchess.move( lastTurn.move, Gitchess.myColor == 'black' );
            print( 'board' );

            if ( chessGame.getStatus().isCheck ) {
                // CHECK!
                print( 'check' );
            }

            if ( chessGame.getStatus().isCheckmate ) {
                // CHECKMATE! You lose!
                print( 'theyWin' );
                process.exit();
            }
        }

        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl._setPrompt = rl.setPrompt;
        rl.setPrompt = function( prompt, length ) {
            rl._setPrompt( prompt, length ? length : prompt.split( /[\r\n]/ ).pop().stripColors.length );
        };

        // prompt user for move
        rl.question( ( lastTurn && lastTurn.capture ? Gitchess.script.capture( lastTurn ) + ' ' : '' ) + Gitchess.script.turn, function( moveStr ) {
            var turn = {
                user: Gitwar.me,
                move: moveStr
            };

            var response = Gitchess.move( moveStr, Gitchess.myColor == 'white' );
            if ( response.error ) {
                print( 'syntaxError' );
                rl.close();
                Gitchess.takeTurn();
            } else {
                if ( response.capture ) {
                    turn.capture = response.capture;
                }

                print( 'board' );

                // check for checkmate
                if ( chessGame.getStatus().isCheckmate ) {
                    print( 'youWin' );
                    Gitwar.addLog( turn )
                    .then( function() {
                        print( 'wrapUp' );
                        return Gitwar.sync();
                    })
                    .then( function() {
                        rl.close();
                        process.exit();
                    });
                } else {
                    if ( chessGame.getStatus().isCheck ) {
                        // CHECK!
                        print( 'check' );
                    }

                    // commit + sync
                    Gitwar.addLog( turn )
                    .then( function() {
                        return Gitchess.wait();
                    });

                    rl.close();
                }
            }
        });
    }
};

// HELPERS

// String method to output according to opponents color
String.prototype.opponentColor = function() {
    if ( Gitchess.myColor == 'black' ) {
        return this.red;
    } else {
        return this.cyan;
    }
};

// Print method to do user-facing logs
var print = function( message, arg ) {
    var scriptItem = Gitchess.script[ message ];

    if ( typeof scriptItem == 'function' ) {
        scriptItem = scriptItem( arg );
    }

    if ( message == 'board' ) {
        clear();
    }
    if ( message == 'wait' ) {
        process.stdout.write( scriptItem );
    } else {
        console.log( scriptItem );
    }
};

// Clears screen between drawing chess baord
var clear = function() {
    var lines = process.stdout.getWindowSize()[ 1 ];
    for ( var i = 0; i < lines; i++ ) {
        console.log( '\r\n' );
    }
};

// Head, tail and lines for chess board
var boardHead = '    A    B    C    D    E    F    G    H\n' +
    '  ┌────┬────┬────┬────┬────┬────┬────┬────┐\n';
var boardTail = '\n  └────┴────┴────┴────┴────┴────┴────┴────┘\n' +
    '    A    B    C    D    E    F    G    H\n';
var boardLine = '\n  ├────┼────┼────┼────┼────┼────┼────┼────┤\n';

// Start game
Gitchess.init();

module.exports = Gitchess;
