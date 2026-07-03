/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hiddenhand.json`.
 */
export type Hiddenhand = {
  "address": "9chPz3vJDeU7gr4zBtDreJUpVLKbqwrKoQBQQjT1SF5X",
  "metadata": {
    "name": "hiddenhand",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "HiddenHand - Privacy Poker on Solana",
    "Card shuffle, deal, and reveal run as Arcium MPC circuits (Phase 3b):",
    "the deck is shuffled in-MPC, stored on-chain as opaque ciphertext, and",
    "re-fed into every later circuit. All betting/pot/showdown-eval logic stays",
    "on the public Solana path."
  ],
  "instructions": [
    {
      "name": "closeInactiveTable",
      "docs": [
        "Close an inactive table and return all funds to players",
        "Can be called by anyone after 1 hour of inactivity"
      ],
      "discriminator": [
        53,
        209,
        84,
        38,
        178,
        114,
        230,
        103
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can call this after timeout"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "The token vault holding player funds"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token mint — must match the table's configured mint"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "collectRake",
      "docs": [
        "Collect accumulated rake from the table vault",
        "Only the table authority can call this, and only when not mid-hand"
      ],
      "discriminator": [
        243,
        193,
        227,
        46,
        76,
        110,
        183,
        204
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Only the table authority can collect rake"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "authorityTokenAccount",
          "docs": [
            "Authority's token account to receive rake"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Table's token vault holding player chips + accumulated rake"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token mint — must match the table's configured mint"
          ]
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createTable",
      "docs": [
        "Create a new poker table",
        "rake_bps: rake in basis points (0 = no rake, max 1000 = 10%)",
        "rake_cap: maximum rake per hand in lamports (0 = no cap)"
      ],
      "discriminator": [
        214,
        142,
        131,
        250,
        242,
        83,
        135,
        185
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tableId"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "SPL token mint for this table (e.g. USDC)"
          ]
        },
        {
          "name": "vault",
          "docs": [
            "Token vault to hold player buy-ins — PDA owned by the table"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tableId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "smallBlind",
          "type": "u64"
        },
        {
          "name": "bigBlind",
          "type": "u64"
        },
        {
          "name": "minBuyIn",
          "type": "u64"
        },
        {
          "name": "maxBuyIn",
          "type": "u64"
        },
        {
          "name": "maxPlayers",
          "type": "u8"
        },
        {
          "name": "rakeBps",
          "type": "u16"
        },
        {
          "name": "rakeCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "dealToSeat",
      "discriminator": [
        252,
        146,
        205,
        23,
        80,
        48,
        167,
        187
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "playerSeat",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "seatIndex",
          "type": "u8"
        },
        {
          "name": "seatPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "seatNonce",
          "type": "u128"
        }
      ]
    },
    {
      "name": "dealToSeatCallback",
      "discriminator": [
        12,
        177,
        21,
        174,
        146,
        209,
        175,
        50
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "dealToSeatOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "initDealToSeatCompDef",
      "discriminator": [
        117,
        227,
        118,
        151,
        147,
        154,
        94,
        175
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealFlopCompDef",
      "discriminator": [
        75,
        43,
        20,
        47,
        60,
        46,
        223,
        131
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealRiverCompDef",
      "discriminator": [
        90,
        9,
        148,
        19,
        162,
        62,
        45,
        152
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealTurnCompDef",
      "discriminator": [
        77,
        150,
        125,
        27,
        232,
        214,
        120,
        189
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initShowdownRevealCompDef",
      "discriminator": [
        190,
        195,
        19,
        8,
        179,
        28,
        67,
        228
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initShuffleCompDef",
      "discriminator": [
        194,
        175,
        67,
        37,
        158,
        107,
        165,
        180
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinTable",
      "docs": [
        "Join a table with a buy-in"
      ],
      "discriminator": [
        14,
        117,
        84,
        51,
        95,
        146,
        171,
        70
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "playerSeat",
          "writable": true
        },
        {
          "name": "playerTokenAccount",
          "docs": [
            "Player's token account (source of buy-in funds)"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Table's token vault (destination for buy-in)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token mint — must match the table's configured mint"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seatIndex",
          "type": "u8"
        },
        {
          "name": "buyIn",
          "type": "u64"
        }
      ]
    },
    {
      "name": "leaveTable",
      "docs": [
        "Leave a table and cash out"
      ],
      "discriminator": [
        163,
        153,
        94,
        194,
        19,
        106,
        113,
        32
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true,
          "relations": [
            "playerSeat"
          ]
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "playerSeat",
          "writable": true
        },
        {
          "name": "playerTokenAccount",
          "docs": [
            "Player's token account to receive chips"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Table's token vault"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Token mint — must match the table's configured mint"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "playerAction",
      "docs": [
        "Perform a player action (fold, check, call, raise, all-in)"
      ],
      "discriminator": [
        37,
        85,
        25,
        135,
        200,
        116,
        96,
        101
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "playerSeat",
          "writable": true
        },
        {
          "name": "sessionToken",
          "docs": [
            "Session token account — optional. When present, validates that",
            "the signer is an authorized session key for this player's wallet.",
            "When absent, the signer must be the player's wallet directly."
          ],
          "optional": true
        }
      ],
      "args": [
        {
          "name": "action",
          "type": {
            "defined": {
              "name": "action"
            }
          }
        }
      ]
    },
    {
      "name": "revealFlop",
      "discriminator": [
        187,
        231,
        36,
        222,
        69,
        4,
        1,
        182
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "caller",
          "docs": [
            "The account whose authority/timeout is checked to reveal."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "docs": [
            "Session token — optional. Lets the table authority reveal popup-free."
          ],
          "optional": true
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revealFlopCallback",
      "discriminator": [
        119,
        102,
        45,
        183,
        30,
        8,
        54,
        144
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "table"
        },
        {
          "name": "handState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealFlopOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "revealRiver",
      "discriminator": [
        137,
        134,
        105,
        111,
        92,
        111,
        253,
        16
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revealRiverCallback",
      "discriminator": [
        59,
        241,
        139,
        16,
        109,
        254,
        156,
        29
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "table"
        },
        {
          "name": "handState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealRiverOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "revealTurn",
      "discriminator": [
        51,
        190,
        29,
        5,
        57,
        93,
        210,
        137
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "revealTurnCallback",
      "discriminator": [
        170,
        33,
        15,
        121,
        7,
        59,
        114,
        82
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "table"
        },
        {
          "name": "handState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealTurnOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "showdown",
      "docs": [
        "Showdown - evaluate hands and distribute pot",
        "Remaining accounts should be all player seat accounts"
      ],
      "discriminator": [
        42,
        62,
        227,
        166,
        247,
        144,
        182,
        162
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can call showdown, but non-authority must wait for timeout"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "showdownReveal",
      "discriminator": [
        137,
        41,
        46,
        91,
        79,
        87,
        115,
        245
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "showdownRevealCallback",
      "discriminator": [
        17,
        171,
        8,
        53,
        156,
        107,
        21,
        236
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "table"
        },
        {
          "name": "handState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "showdownRevealOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "shuffle",
      "discriminator": [
        179,
        228,
        145,
        133,
        78,
        16,
        250,
        235
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "shuffleCallback",
      "discriminator": [
        194,
        63,
        246,
        15,
        138,
        108,
        43,
        64
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "deckState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "shuffleOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "startHand",
      "docs": [
        "Start a new hand (table authority only)"
      ],
      "discriminator": [
        50,
        173,
        164,
        52,
        65,
        42,
        197,
        135
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can call, but non-authority must wait for timeout"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true
        },
        {
          "name": "deckState",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "timeoutDeal",
      "docs": [
        "Abort a hand stuck in the Dealing phase because a seated player never ran",
        "deal_to_seat (AFK). Callable by anyone after DEAL_TIMEOUT_SECONDS; refunds",
        "posted blinds, resets seats, and returns the table to Waiting.",
        "Remaining accounts: all occupied player seat accounts."
      ],
      "discriminator": [
        100,
        29,
        155,
        49,
        123,
        164,
        194,
        103
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can call once the deal timeout has elapsed."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "table",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "timeoutPlayer",
      "docs": [
        "Timeout a player who hasn't acted within 60 seconds",
        "Anyone can call this to keep the game moving",
        "Auto-checks if possible, otherwise auto-folds"
      ],
      "discriminator": [
        102,
        1,
        155,
        241,
        165,
        224,
        122,
        149
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone can trigger a timeout (doesn't need to be authority or the timed-out player)"
          ],
          "signer": true
        },
        {
          "name": "table",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "table.table_id",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "handState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "deckState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "table.hand_number",
                "account": "table"
              }
            ]
          }
        },
        {
          "name": "playerSeat",
          "docs": [
            "The seat of the player being timed out"
          ],
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "arciumSignerAccount",
      "discriminator": [
        214,
        157,
        122,
        114,
        117,
        44,
        214,
        74
      ]
    },
    {
      "name": "deckState",
      "discriminator": [
        190,
        100,
        169,
        83,
        107,
        23,
        168,
        21
      ]
    },
    {
      "name": "handState",
      "discriminator": [
        85,
        99,
        137,
        55,
        120,
        251,
        40,
        38
      ]
    },
    {
      "name": "playerSeat",
      "discriminator": [
        100,
        254,
        179,
        67,
        8,
        150,
        238,
        232
      ]
    },
    {
      "name": "table",
      "discriminator": [
        34,
        100,
        138,
        97,
        236,
        129,
        230,
        112
      ]
    }
  ],
  "events": [
    {
      "name": "actionTaken",
      "discriminator": [
        128,
        186,
        77,
        12,
        99,
        195,
        48,
        60
      ]
    },
    {
      "name": "communityCardsRevealed",
      "discriminator": [
        194,
        255,
        78,
        4,
        116,
        95,
        22,
        180
      ]
    },
    {
      "name": "deckShuffled",
      "discriminator": [
        34,
        1,
        216,
        81,
        108,
        223,
        225,
        81
      ]
    },
    {
      "name": "handCompleted",
      "discriminator": [
        84,
        11,
        82,
        98,
        9,
        74,
        200,
        229
      ]
    },
    {
      "name": "handStarted",
      "discriminator": [
        92,
        115,
        135,
        103,
        133,
        169,
        143,
        43
      ]
    },
    {
      "name": "holeDealt",
      "discriminator": [
        23,
        253,
        185,
        139,
        35,
        189,
        172,
        218
      ]
    },
    {
      "name": "showdownReveal",
      "discriminator": [
        87,
        131,
        37,
        141,
        199,
        192,
        92,
        178
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tableFull",
      "msg": "Table is full"
    },
    {
      "code": 6001,
      "name": "notEnoughPlayers",
      "msg": "Table is not full enough to start"
    },
    {
      "code": 6002,
      "name": "playerNotAtTable",
      "msg": "Player is not at this table"
    },
    {
      "code": 6003,
      "name": "playerAlreadyAtTable",
      "msg": "Player is already at this table"
    },
    {
      "code": 6004,
      "name": "invalidSeatIndex",
      "msg": "Invalid seat index"
    },
    {
      "code": 6005,
      "name": "seatOccupied",
      "msg": "Seat is already occupied"
    },
    {
      "code": 6006,
      "name": "seatEmpty",
      "msg": "Seat is empty"
    },
    {
      "code": 6007,
      "name": "notPlayersTurn",
      "msg": "Not player's turn"
    },
    {
      "code": 6008,
      "name": "invalidAction",
      "msg": "Invalid action for current game state"
    },
    {
      "code": 6009,
      "name": "insufficientChips",
      "msg": "Insufficient chips"
    },
    {
      "code": 6010,
      "name": "invalidBuyIn",
      "msg": "Buy-in amount out of range"
    },
    {
      "code": 6011,
      "name": "handNotInProgress",
      "msg": "Hand is not in progress"
    },
    {
      "code": 6012,
      "name": "handAlreadyInProgress",
      "msg": "Hand is already in progress"
    },
    {
      "code": 6013,
      "name": "cannotFold",
      "msg": "Cannot fold - no bet to fold from"
    },
    {
      "code": 6014,
      "name": "cannotCheck",
      "msg": "Cannot check - must call or raise"
    },
    {
      "code": 6015,
      "name": "raiseTooSmall",
      "msg": "Raise amount too small"
    },
    {
      "code": 6016,
      "name": "bettingRoundNotComplete",
      "msg": "Betting round not complete"
    },
    {
      "code": 6017,
      "name": "invalidPhase",
      "msg": "Invalid phase for this action"
    },
    {
      "code": 6018,
      "name": "actionTimeout",
      "msg": "Player action timeout"
    },
    {
      "code": 6019,
      "name": "actionNotTimedOut",
      "msg": "Player has not timed out yet - must wait 60 seconds"
    },
    {
      "code": 6020,
      "name": "unauthorizedAuthority",
      "msg": "Only table authority can perform this action"
    },
    {
      "code": 6021,
      "name": "showdownRequiresPlayers",
      "msg": "Showdown requires at least 2 active players"
    },
    {
      "code": 6022,
      "name": "invalidCardIndex",
      "msg": "Invalid card index"
    },
    {
      "code": 6023,
      "name": "deckAlreadyShuffled",
      "msg": "Deck already shuffled for this hand"
    },
    {
      "code": 6024,
      "name": "deckNotShuffled",
      "msg": "Deck not yet shuffled - shuffle the deck (MPC) first"
    },
    {
      "code": 6025,
      "name": "cardsNotDealt",
      "msg": "Cards not yet dealt"
    },
    {
      "code": 6026,
      "name": "allCardsRevealed",
      "msg": "All community cards already revealed"
    },
    {
      "code": 6027,
      "name": "playerFolded",
      "msg": "Player has already folded"
    },
    {
      "code": 6028,
      "name": "playerAlreadyAllIn",
      "msg": "Player is already all-in"
    },
    {
      "code": 6029,
      "name": "tableNotWaiting",
      "msg": "Table is not in waiting state"
    },
    {
      "code": 6030,
      "name": "cannotLeaveDuringHand",
      "msg": "Cannot leave during active hand"
    },
    {
      "code": 6031,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6032,
      "name": "duplicateAccount",
      "msg": "Duplicate accounts provided"
    },
    {
      "code": 6033,
      "name": "invalidRemainingAccounts",
      "msg": "Invalid remaining accounts"
    },
    {
      "code": 6034,
      "name": "invalidAccountCount",
      "msg": "Invalid account count - expected multiple of 3 for encryption"
    },
    {
      "code": 6035,
      "name": "cardsAlreadyRevealed",
      "msg": "Cards have already been revealed"
    },
    {
      "code": 6036,
      "name": "playerNotActive",
      "msg": "Player is not active (folded or not playing)"
    },
    {
      "code": 6037,
      "name": "invalidCard",
      "msg": "Invalid card value - must be 0-51"
    },
    {
      "code": 6038,
      "name": "ed25519VerificationFailed",
      "msg": "Signature verification failed"
    },
    {
      "code": 6039,
      "name": "playersNotRevealed",
      "msg": "All active players must reveal before showdown can complete"
    },
    {
      "code": 6040,
      "name": "timeoutNotReached",
      "msg": "Timeout not reached - must wait longer"
    },
    {
      "code": 6041,
      "name": "notYourSeat",
      "msg": "This is not your seat"
    },
    {
      "code": 6042,
      "name": "cardsNotEncrypted",
      "msg": "Cards are not encrypted yet"
    },
    {
      "code": 6043,
      "name": "handInProgress",
      "msg": "Cannot perform this action while hand is in progress"
    },
    {
      "code": 6044,
      "name": "awaitingCommunityReveal",
      "msg": "Waiting for community cards to be revealed - authority must call reveal_community"
    },
    {
      "code": 6045,
      "name": "communityNotReady",
      "msg": "Community cards not ready for reveal - betting round not complete"
    },
    {
      "code": 6046,
      "name": "invalidCommunityCards",
      "msg": "Invalid community cards for current phase"
    },
    {
      "code": 6047,
      "name": "rakeExceedsLimit",
      "msg": "Rake basis points exceeds maximum (1000 = 10%)"
    },
    {
      "code": 6048,
      "name": "noRakeToCollect",
      "msg": "No accumulated rake to collect"
    },
    {
      "code": 6049,
      "name": "invalidTokenMint",
      "msg": "Token mint does not match table's configured token"
    },
    {
      "code": 6050,
      "name": "abortedComputation",
      "msg": "The MPC computation was aborted"
    },
    {
      "code": 6051,
      "name": "invalidSeat",
      "msg": "Seat index does not match the player seat account"
    },
    {
      "code": 6052,
      "name": "playerNotInHand",
      "msg": "Player was not dealt into this hand"
    },
    {
      "code": 6053,
      "name": "alreadyDealt",
      "msg": "This seat has already been dealt its hole cards"
    }
  ],
  "types": [
    {
      "name": "action",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fold"
          },
          {
            "name": "check"
          },
          {
            "name": "call"
          },
          {
            "name": "raise",
            "fields": [
              {
                "name": "amount",
                "type": "u64"
              }
            ]
          },
          {
            "name": "allIn"
          }
        ]
      }
    },
    {
      "name": "actionTaken",
      "docs": [
        "Emitted when a player acts or is timed out"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "docs": [
              "Table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          },
          {
            "name": "seatIndex",
            "docs": [
              "Seat index of the player who acted"
            ],
            "type": "u8"
          },
          {
            "name": "actionType",
            "docs": [
              "0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn, 5=TimeoutFold, 6=TimeoutCheck"
            ],
            "type": "u8"
          },
          {
            "name": "amount",
            "docs": [
              "Amount bet in this action (0 for fold/check)"
            ],
            "type": "u64"
          },
          {
            "name": "potAfter",
            "docs": [
              "Total pot after this action"
            ],
            "type": "u64"
          },
          {
            "name": "phase",
            "docs": [
              "Game phase (0=Dealing, 1=PreFlop, 2=Flop, 3=Turn, 4=River, 5=Showdown, 6=Settled)"
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "nextActionOn",
            "docs": [
              "Next player to act (255 if round/hand ended)"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "activation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "activationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "deactivationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          }
        ]
      }
    },
    {
      "name": "arciumSignerAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "bn254g2blsPublicKey",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "array": [
              "u8",
              64
            ]
          }
        ]
      }
    },
    {
      "name": "circuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "local",
            "fields": [
              {
                "defined": {
                  "name": "localCircuitSource"
                }
              }
            ]
          },
          {
            "name": "onChain",
            "fields": [
              {
                "defined": {
                  "name": "onChainCircuitSource"
                }
              }
            ]
          },
          {
            "name": "offChain",
            "fields": [
              {
                "defined": {
                  "name": "offChainCircuitSource"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "clockAccount",
      "docs": [
        "An account storing the current network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "currentEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "startEpochTimestamp",
            "type": {
              "defined": {
                "name": "timestamp"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "cluster",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tdInfo",
            "type": {
              "option": {
                "defined": {
                  "name": "nodeMetadata"
                }
              }
            }
          },
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "clusterSize",
            "type": "u16"
          },
          {
            "name": "activation",
            "type": {
              "defined": {
                "name": "activation"
              }
            }
          },
          {
            "name": "maxCapacity",
            "type": "u64"
          },
          {
            "name": "cuPrice",
            "type": "u64"
          },
          {
            "name": "cuPriceProposals",
            "type": {
              "array": [
                "u64",
                32
              ]
            }
          },
          {
            "name": "lastUpdatedEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "nodes",
            "type": {
              "vec": {
                "defined": {
                  "name": "nodeRef"
                }
              }
            }
          },
          {
            "name": "pendingNodes",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "blsPublicKey",
            "type": {
              "defined": {
                "name": "setUnset",
                "generics": [
                  {
                    "kind": "type",
                    "type": {
                      "defined": {
                        "name": "bn254g2blsPublicKey"
                      }
                    }
                  }
                ]
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "currentEpochTotalRewards",
            "type": "u64"
          },
          {
            "name": "rewardsEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "leaderSelector",
            "type": {
              "defined": {
                "name": "leaderSelector"
              }
            }
          }
        ]
      }
    },
    {
      "name": "communityCardsRevealed",
      "docs": [
        "Emitted when community cards are revealed (flop/turn/river)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "docs": [
              "Table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          },
          {
            "name": "newPhase",
            "docs": [
              "The phase entering (Flop=2, Turn=3, River=4, Showdown=5 for all-in runout)"
            ],
            "type": "u8"
          },
          {
            "name": "cards",
            "docs": [
              "Card values revealed in this step (3 for flop, 1 for turn, 1 for river)"
            ],
            "type": "bytes"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "actionOn",
            "docs": [
              "Next player to act in new betting round (255 if showdown)"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "computationDefinitionAccount",
      "docs": [
        "An account representing a [ComputationDefinition] in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deactivationSlot",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "cuAmount",
            "type": "u64"
          },
          {
            "name": "definition",
            "type": {
              "defined": {
                "name": "computationDefinitionMeta"
              }
            }
          },
          {
            "name": "circuitSource",
            "type": {
              "defined": {
                "name": "circuitSource"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                24
              ]
            }
          }
        ]
      }
    },
    {
      "name": "computationDefinitionMeta",
      "docs": [
        "A computation definition for execution in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circuitLen",
            "type": "u32"
          },
          {
            "name": "signature",
            "type": {
              "defined": {
                "name": "computationSignature"
              }
            }
          }
        ]
      }
    },
    {
      "name": "computationSignature",
      "docs": [
        "The signature of a computation defined in a [ComputationDefinition]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parameters",
            "type": {
              "vec": {
                "defined": {
                  "name": "parameter"
                }
              }
            }
          },
          {
            "name": "outputs",
            "type": {
              "vec": {
                "defined": {
                  "name": "output"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "dealToSeatOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "sharedEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "2"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "deckShuffled",
      "docs": [
        "Emitted when the MPC `shuffle` circuit finishes and the encrypted deck is",
        "persisted on-chain. Signals the frontend that seats can now be dealt."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "deckState",
      "docs": [
        "Deck state for a hand — Arcium MPC edition.",
        "",
        "The whole 52-card deck is shuffled once in-MPC (`shuffle` circuit) and stored",
        "here as an opaque `Enc<Mxe, Pack<[u8;52]>>` ciphertext (`deck` + `deck_nonce`).",
        "No party — not even a chain observer — can read it. It is re-fed unchanged into",
        "every later circuit (`deal_to_seat`, `reveal_flop/turn/river`, `showdown_reveal`)",
        "via `.account(deck_state.key(), 8, 64)` + `deck_nonce`.",
        "",
        "`deck` is the FIRST field so it sits at byte offset 8 (right after the 8-byte",
        "discriminator), which the `.account()` re-feed requires."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deck",
            "docs": [
              "Enc<Mxe, Pack<[u8;52]>> — the whole shuffled deck as opaque ciphertext.",
              "52 bytes pack into 2 field elements (`[[u8;32];2]`, 64 bytes on-chain).",
              "MUST be the first field (byte offset 8) for the `.account()` re-feed."
            ],
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                2
              ]
            }
          },
          {
            "name": "deckNonce",
            "docs": [
              "Nonce the deck was sealed with (re-fed on every read; never changes here)."
            ],
            "type": "u128"
          },
          {
            "name": "hand",
            "docs": [
              "Reference to the hand this deck belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "handNumber",
            "docs": [
              "Hand number (mirrors HandState.hand_number; used in DeckShuffled event)."
            ],
            "type": "u64"
          },
          {
            "name": "isShuffled",
            "docs": [
              "Whether the MPC shuffle has completed and `deck` is populated."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "epoch",
      "docs": [
        "The network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          "u64"
        ]
      }
    },
    {
      "name": "feePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gamePhase",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "dealing"
          },
          {
            "name": "preFlop"
          },
          {
            "name": "flop"
          },
          {
            "name": "turn"
          },
          {
            "name": "river"
          },
          {
            "name": "showdown"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "handCompleted",
      "docs": [
        "Emitted when a hand completes (showdown or everyone folds)",
        "Contains all information needed to reconstruct and verify the hand"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "docs": [
              "Table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp when hand completed"
            ],
            "type": "i64"
          },
          {
            "name": "communityCards",
            "docs": [
              "Community cards (5 cards, 255 = not dealt)"
            ],
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          },
          {
            "name": "totalPot",
            "docs": [
              "Total pot that was distributed"
            ],
            "type": "u64"
          },
          {
            "name": "playerCount",
            "docs": [
              "Number of players who participated"
            ],
            "type": "u8"
          },
          {
            "name": "results",
            "docs": [
              "Results for each player (up to 6)",
              "Using fixed array because Vec has variable size issues with events"
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "playerHandResult"
                  }
                },
                6
              ]
            }
          },
          {
            "name": "resultsCount",
            "docs": [
              "How many results are valid (rest are zeroed)"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "handStarted",
      "docs": [
        "Emitted when a new hand starts (MPC shuffle complete, all seats dealt in, phase set to PreFlop)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "docs": [
              "Table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "dealerPosition",
            "docs": [
              "Dealer button seat index"
            ],
            "type": "u8"
          },
          {
            "name": "smallBlindSeat",
            "docs": [
              "Small blind seat index"
            ],
            "type": "u8"
          },
          {
            "name": "bigBlindSeat",
            "docs": [
              "Big blind seat index"
            ],
            "type": "u8"
          },
          {
            "name": "smallBlindAmount",
            "docs": [
              "Small blind amount posted"
            ],
            "type": "u64"
          },
          {
            "name": "bigBlindAmount",
            "docs": [
              "Big blind amount posted"
            ],
            "type": "u64"
          },
          {
            "name": "activePlayers",
            "docs": [
              "Bitmap of players dealt into this hand"
            ],
            "type": "u8"
          },
          {
            "name": "playerCount",
            "docs": [
              "Number of active players"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "handState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "table",
            "docs": [
              "Reference to parent table"
            ],
            "type": "pubkey"
          },
          {
            "name": "handNumber",
            "docs": [
              "Hand number (matches table.hand_number when created)"
            ],
            "type": "u64"
          },
          {
            "name": "phase",
            "docs": [
              "Current phase of the hand"
            ],
            "type": {
              "defined": {
                "name": "gamePhase"
              }
            }
          },
          {
            "name": "pot",
            "docs": [
              "Total pot in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "currentBet",
            "docs": [
              "Current bet to call"
            ],
            "type": "u64"
          },
          {
            "name": "minRaise",
            "docs": [
              "Minimum raise amount"
            ],
            "type": "u64"
          },
          {
            "name": "dealerPosition",
            "docs": [
              "Dealer position for this hand"
            ],
            "type": "u8"
          },
          {
            "name": "actionOn",
            "docs": [
              "Seat index of player whose turn it is"
            ],
            "type": "u8"
          },
          {
            "name": "communityCards",
            "docs": [
              "Community cards (card indices 0-51, 255 = not revealed)"
            ],
            "type": "bytes"
          },
          {
            "name": "communityRevealed",
            "docs": [
              "Number of community cards revealed (0, 3, 4, or 5)"
            ],
            "type": "u8"
          },
          {
            "name": "activePlayers",
            "docs": [
              "Bitmap of players still active in hand"
            ],
            "type": "u8"
          },
          {
            "name": "actedThisRound",
            "docs": [
              "Bitmap of players who have acted this round"
            ],
            "type": "u8"
          },
          {
            "name": "activeCount",
            "docs": [
              "Number of active players"
            ],
            "type": "u8"
          },
          {
            "name": "allInPlayers",
            "docs": [
              "Bitmap of players who are all-in"
            ],
            "type": "u8"
          },
          {
            "name": "lastActionTime",
            "docs": [
              "Last action timestamp for timeout tracking (unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "handStartTime",
            "docs": [
              "Timestamp when hand started (unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "awaitingCommunityReveal",
            "docs": [
              "Whether we're waiting for authority to reveal community cards",
              "Set to true when betting round completes and phase needs to advance"
            ],
            "type": "bool"
          },
          {
            "name": "dealtPlayers",
            "docs": [
              "Bitmap of players whose hole cards have been dealt this hand.",
              "Set per seat by `deal_to_seat`; when it equals `active_players`,",
              "dealing is complete and the phase advances to PreFlop."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "holeDealt",
      "docs": [
        "Emitted per seat by the `deal_to_seat` MPC callback. The sealed hole cards are",
        "addressed to a single client key; only the seat that owns `enc_pubkey` can",
        "decrypt `card0`/`card1` (via the Arcium client RescueCipher)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "encPubkey",
            "docs": [
              "The client x25519 public key the cards were sealed to."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "Nonce used for the sealed ciphertext (little-endian u128)."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "card0",
            "docs": [
              "Sealed first hole card (one field element)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "card1",
            "docs": [
              "Sealed second hole card (one field element)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "leaderChoice",
      "docs": [
        "The computation chosen by a node to be executed when the node is leader."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u64"
          },
          {
            "name": "slotIdx",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "leaderInfo",
      "docs": [
        "The information about a node."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "lastCounterPlusOne",
            "type": "u64"
          },
          {
            "name": "choice",
            "type": {
              "defined": {
                "name": "leaderChoice"
              }
            }
          }
        ]
      }
    },
    {
      "name": "leaderSelector",
      "docs": [
        "To select a Leader.",
        "Uses the greatest divisors method: https://en.wikipedia.org/wiki/D%27Hondt_method"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakingEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "info",
            "type": {
              "vec": {
                "defined": {
                  "name": "leaderInfo"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "localCircuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "mxeKeygen"
          },
          {
            "name": "mxeKeyRecoveryInit"
          },
          {
            "name": "mxeKeyRecoveryFinalize"
          }
        ]
      }
    },
    {
      "name": "mxeAccount",
      "docs": [
        "A MPC Execution Environment."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "padding",
            "type": "u8"
          },
          {
            "name": "cluster",
            "type": "u32"
          },
          {
            "name": "keygenOffset",
            "type": "u64"
          },
          {
            "name": "keyRecoveryInitOffset",
            "type": "u64"
          },
          {
            "name": "mxeProgramId",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "utilityPubkeys",
            "type": {
              "defined": {
                "name": "setUnset",
                "generics": [
                  {
                    "kind": "type",
                    "type": {
                      "defined": {
                        "name": "utilityPubkeys"
                      }
                    }
                  }
                ]
              }
            }
          },
          {
            "name": "lutOffsetSlot",
            "type": "u64"
          },
          {
            "name": "computationDefinitions",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "mxeStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "currentEpochRecoveryRewards",
            "type": "u64"
          },
          {
            "name": "recoveryRewardsEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          }
        ]
      }
    },
    {
      "name": "mxeEncryptedStruct",
      "generics": [
        {
          "kind": "const",
          "name": "len",
          "type": "usize"
        }
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u128"
          },
          {
            "name": "ciphertexts",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                {
                  "generic": "len"
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "mxeStatus",
      "docs": [
        "The status of an MXE."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "migration"
          }
        ]
      }
    },
    {
      "name": "nodeMetadata",
      "docs": [
        "location as [ISO 3166-1 alpha-2](https://www.iso.org/iso-3166-country-codes.html) country code"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ip",
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          },
          {
            "name": "peerId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "location",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nodeRef",
      "docs": [
        "A reference to a node in the cluster.",
        "The offset is to derive the Node Account."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u32"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "vote",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "offChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "source",
            "type": "string"
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "onChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isCompleted",
            "type": "bool"
          },
          {
            "name": "uploadAuth",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "output",
      "docs": [
        "An output of a computation.",
        "We currently don't support encrypted outputs yet since encrypted values are passed via",
        "data objects."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisX25519Pubkey"
          },
          {
            "name": "plaintextFloat"
          },
          {
            "name": "plaintextPoint"
          },
          {
            "name": "plaintextI8"
          },
          {
            "name": "plaintextI16"
          },
          {
            "name": "plaintextI32"
          },
          {
            "name": "plaintextI64"
          },
          {
            "name": "plaintextI128"
          }
        ]
      }
    },
    {
      "name": "parameter",
      "docs": [
        "A parameter of a computation.",
        "We differentiate between plaintext and encrypted parameters and data objects.",
        "Plaintext parameters are directly provided as their value.",
        "Encrypted parameters are provided as an offchain reference to the data.",
        "Data objects are provided as a reference to the data object account."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisX25519Pubkey"
          },
          {
            "name": "arcisSignature"
          },
          {
            "name": "plaintextFloat"
          },
          {
            "name": "plaintextI8"
          },
          {
            "name": "plaintextI16"
          },
          {
            "name": "plaintextI32"
          },
          {
            "name": "plaintextI64"
          },
          {
            "name": "plaintextI128"
          },
          {
            "name": "plaintextPoint"
          }
        ]
      }
    },
    {
      "name": "playerHandResult",
      "docs": [
        "Individual player's result in a hand"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "docs": [
              "Player's wallet pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "seatIndex",
            "docs": [
              "Seat index (0-5)"
            ],
            "type": "u8"
          },
          {
            "name": "holeCard1",
            "docs": [
              "Hole cards (255 = not shown / folded)"
            ],
            "type": "u8"
          },
          {
            "name": "holeCard2",
            "type": "u8"
          },
          {
            "name": "handRank",
            "docs": [
              "Hand rank (0=HighCard, 1=Pair, ..., 9=RoyalFlush, 255=folded/not evaluated)"
            ],
            "type": "u8"
          },
          {
            "name": "chipsWon",
            "docs": [
              "Chips won this hand (0 if lost)"
            ],
            "type": "u64"
          },
          {
            "name": "chipsBet",
            "docs": [
              "Total bet this hand (chips put into pot)"
            ],
            "type": "u64"
          },
          {
            "name": "folded",
            "docs": [
              "Whether player folded"
            ],
            "type": "bool"
          },
          {
            "name": "allIn",
            "docs": [
              "Whether player was all-in"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "playerSeat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "table",
            "docs": [
              "Reference to table"
            ],
            "type": "pubkey"
          },
          {
            "name": "player",
            "docs": [
              "Player's wallet"
            ],
            "type": "pubkey"
          },
          {
            "name": "seatIndex",
            "docs": [
              "Seat index (0 to max_players-1)"
            ],
            "type": "u8"
          },
          {
            "name": "chips",
            "docs": [
              "Player's chip stack at this table"
            ],
            "type": "u64"
          },
          {
            "name": "currentBet",
            "docs": [
              "Amount bet in current betting round"
            ],
            "type": "u64"
          },
          {
            "name": "totalBetThisHand",
            "docs": [
              "Total amount invested in current hand"
            ],
            "type": "u64"
          },
          {
            "name": "revealedCard1",
            "docs": [
              "Revealed plaintext card 1 (0-51, or 255 if not revealed).",
              "Written by the `showdown_reveal` MPC callback."
            ],
            "type": "u8"
          },
          {
            "name": "revealedCard2",
            "docs": [
              "Revealed plaintext card 2 (0-51, or 255 if not revealed)"
            ],
            "type": "u8"
          },
          {
            "name": "cardsRevealed",
            "docs": [
              "Whether player has revealed their cards for showdown"
            ],
            "type": "bool"
          },
          {
            "name": "status",
            "docs": [
              "Current status"
            ],
            "type": {
              "defined": {
                "name": "playerStatus"
              }
            }
          },
          {
            "name": "hasActed",
            "docs": [
              "Has acted in current betting round"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "playerStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "sitting"
          },
          {
            "name": "playing"
          },
          {
            "name": "folded"
          },
          {
            "name": "allIn"
          }
        ]
      }
    },
    {
      "name": "revealFlopOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "revealRiverOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "revealTurnOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sessionToken",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "sessionSigner",
            "type": "pubkey"
          },
          {
            "name": "validUntil",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "setUnset",
      "docs": [
        "Utility struct to store a value that needs to be set by a certain number of participants (keys",
        "in our case). Once all participants have set the value, the value is considered set and we only",
        "store it once."
      ],
      "generics": [
        {
          "kind": "type",
          "name": "t"
        }
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "set",
            "fields": [
              {
                "generic": "t"
              }
            ]
          },
          {
            "name": "unset",
            "fields": [
              {
                "generic": "t"
              },
              {
                "vec": "bool"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "sharedEncryptedStruct",
      "generics": [
        {
          "kind": "const",
          "name": "len",
          "type": "usize"
        }
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "encryptionKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "type": "u128"
          },
          {
            "name": "ciphertexts",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                {
                  "generic": "len"
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "showdownReveal",
      "docs": [
        "Emitted when a player reveals their hole cards at showdown"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tableId",
            "docs": [
              "Table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Sequential hand number"
            ],
            "type": "u64"
          },
          {
            "name": "seatIndex",
            "docs": [
              "Seat index of the revealing player"
            ],
            "type": "u8"
          },
          {
            "name": "card1",
            "docs": [
              "First hole card (0-51)"
            ],
            "type": "u8"
          },
          {
            "name": "card2",
            "docs": [
              "Second hole card (0-51)"
            ],
            "type": "u8"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "showdownRevealOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "showdownRevealOutputStruct0"
                  }
                },
                9
              ]
            }
          }
        ]
      }
    },
    {
      "name": "showdownRevealOutputStruct0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": "u8"
          },
          {
            "name": "field1",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "shuffleOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "2"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "signedComputationOutputs",
      "generics": [
        {
          "kind": "type",
          "name": "o"
        }
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "success",
            "fields": [
              {
                "generic": "o"
              },
              {
                "array": [
                  "u8",
                  64
                ]
              }
            ]
          },
          {
            "name": "failure"
          },
          {
            "name": "markerForIdlBuildDoNotUseThis",
            "fields": [
              {
                "generic": "o"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "table",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Table creator/authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "tableId",
            "docs": [
              "Unique table identifier"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "smallBlind",
            "docs": [
              "Small blind amount in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "bigBlind",
            "docs": [
              "Big blind amount (typically 2x small blind)"
            ],
            "type": "u64"
          },
          {
            "name": "minBuyIn",
            "docs": [
              "Minimum buy-in amount"
            ],
            "type": "u64"
          },
          {
            "name": "maxBuyIn",
            "docs": [
              "Maximum buy-in amount"
            ],
            "type": "u64"
          },
          {
            "name": "maxPlayers",
            "docs": [
              "Maximum players allowed (2-6)"
            ],
            "type": "u8"
          },
          {
            "name": "currentPlayers",
            "docs": [
              "Current number of seated players"
            ],
            "type": "u8"
          },
          {
            "name": "status",
            "docs": [
              "Current table status"
            ],
            "type": {
              "defined": {
                "name": "tableStatus"
              }
            }
          },
          {
            "name": "handNumber",
            "docs": [
              "Current hand number (increments each hand)"
            ],
            "type": "u64"
          },
          {
            "name": "occupiedSeats",
            "docs": [
              "Bitmap of occupied seats (bit i = seat i occupied)"
            ],
            "type": "u8"
          },
          {
            "name": "dealerPosition",
            "docs": [
              "Dealer button position (seat index)"
            ],
            "type": "u8"
          },
          {
            "name": "lastReadyTime",
            "docs": [
              "Timestamp when table became ready for new hand (for timeout fallback)"
            ],
            "type": "i64"
          },
          {
            "name": "rakeBps",
            "docs": [
              "Rake in basis points (0 = no rake, max 1000 = 10%)"
            ],
            "type": "u16"
          },
          {
            "name": "rakeCap",
            "docs": [
              "Maximum rake per hand in lamports (0 = no cap)"
            ],
            "type": "u64"
          },
          {
            "name": "accumulatedRake",
            "docs": [
              "Accumulated rake available for collection by authority"
            ],
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "docs": [
              "SPL token mint for this table (e.g. USDC, wSOL)",
              "Each table is denominated in a single token — players must use this token to buy in"
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenDecimals",
            "docs": [
              "Cached token decimals (e.g. 6 for USDC, 9 for SOL)",
              "Stored on-chain to avoid passing mint account for display/logging"
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tableStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waiting"
          },
          {
            "name": "playing"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "timestamp",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "utilityPubkeys",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x25519Pubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ed25519VerifyingKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "elgamalPubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "pubkeyValidityProof",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    }
  ]
};
