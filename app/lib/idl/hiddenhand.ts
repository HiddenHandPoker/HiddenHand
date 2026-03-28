/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hiddenhand.json`.
 */
export type Hiddenhand = {
  "address": "5fcckjDn8wzRSodJbQVpHeuWZ8x4B3htKv1WEMx36XJe",
  "metadata": {
    "name": "hiddenhand",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "HiddenHand - Privacy Poker on Solana",
    "Using MagicBlock VRF for provably fair shuffling and",
    "Inco FHE for cryptographic card privacy"
  ],
  "instructions": [
    {
      "name": "callbackShuffle",
      "docs": [
        "VRF callback - ATOMIC shuffle + encrypt",
        "Called by VRF oracle, not directly by users",
        "",
        "SECURITY: The VRF seed is NEVER stored in account state!",
        "Shuffle and encryption happen atomically in this single transaction."
      ],
      "discriminator": [
        61,
        96,
        191,
        76,
        226,
        182,
        70,
        95
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "signer": true,
          "address": "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw"
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
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "closeInactiveTable",
      "docs": [
        "Close an inactive table and return all funds to players",
        "Can be called by anyone after 1 hour of inactivity",
        "Table must be in Waiting status (not mid-hand)",
        "All seated players receive their chips back"
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
      "name": "dealCards",
      "docs": [
        "DEPRECATED: Plaintext dealing for local testing ONLY.",
        "Cards are stored unencrypted on-chain — DO NOT use in production.",
        "For production, use request_shuffle + callback_shuffle (VRF + Inco FHE)."
      ],
      "discriminator": [
        38,
        218,
        247,
        103,
        218,
        237,
        24,
        65
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
          "name": "sbSeat",
          "docs": [
            "Small blind player seat"
          ],
          "writable": true
        },
        {
          "name": "bbSeat",
          "docs": [
            "Big blind player seat"
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "dealCardsEncrypted",
      "docs": [
        "Deal cards with ATOMIC Inco encryption (RECOMMENDED for privacy)",
        "Cards are encrypted immediately during dealing - NEVER stored as plaintext",
        "After calling this, use grant_card_allowance for each player to enable decryption"
      ],
      "discriminator": [
        224,
        161,
        115,
        102,
        206,
        20,
        208,
        215
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "The caller (authority can call immediately, others must wait for timeout)"
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
          "name": "sbSeat",
          "docs": [
            "Small blind player seat"
          ],
          "writable": true
        },
        {
          "name": "bbSeat",
          "docs": [
            "Big blind player seat"
          ],
          "writable": true
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program for encryption"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "encryptHoleCards",
      "docs": [
        "Phase 1: Encrypt hole cards using Inco FHE",
        "Called via Magic Actions after ER commit",
        "Encrypts plaintext cards and stores handles in PlayerSeat",
        "Call once per player with their seat_index",
        "IMPORTANT: After this, call grant_card_allowance to enable decryption"
      ],
      "discriminator": [
        40,
        216,
        64,
        170,
        117,
        35,
        224,
        127
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The table authority"
          ],
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
          "name": "playerSeat",
          "docs": [
            "The player seat to encrypt cards for"
          ],
          "writable": true
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program for encryption"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
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
        }
      ]
    },
    {
      "name": "grantCardAllowance",
      "docs": [
        "Phase 2: Grant decryption allowance for encrypted cards",
        "Must be called AFTER encrypt_hole_cards",
        "Client should derive allowance PDAs from stored handles:",
        "PDA = [\"allowance\", handle.to_le_bytes(), player_pubkey]"
      ],
      "discriminator": [
        185,
        114,
        158,
        112,
        132,
        195,
        242,
        109
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The table authority - only authority can grant allowances"
          ],
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
          "name": "playerSeat",
          "docs": [
            "The player seat with encrypted cards"
          ]
        },
        {
          "name": "allowanceCard1",
          "docs": [
            "Allowance account for card 1",
            "Must be PDA: [\"allowance\", hole_card_1.to_le_bytes(), player_pubkey]"
          ],
          "writable": true
        },
        {
          "name": "allowanceCard2",
          "docs": [
            "Allowance account for card 2",
            "Must be PDA: [\"allowance\", hole_card_2.to_le_bytes(), player_pubkey]"
          ],
          "writable": true
        },
        {
          "name": "player",
          "docs": [
            "The player who should be able to decrypt"
          ]
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
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
        }
      ]
    },
    {
      "name": "grantCommunityAllowances",
      "docs": [
        "Grant community card allowances to a player",
        "This enables the player to decrypt community cards via Inco, which is needed",
        "if they want to reveal community cards when authority is AFK",
        "",
        "Called by authority after VRF shuffle for each active player.",
        "remaining_accounts: 5 allowance PDAs for community cards [card0-card4]"
      ],
      "discriminator": [
        96,
        96,
        218,
        243,
        156,
        151,
        51,
        191
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Authority granting allowances (only authority can grant)"
          ],
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
            "The player seat to grant allowances for"
          ]
        },
        {
          "name": "player",
          "docs": [
            "The player who should be able to decrypt"
          ]
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
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
        }
      ]
    },
    {
      "name": "grantOwnAllowance",
      "docs": [
        "Allow player to grant their OWN decryption allowance after timeout",
        "If authority doesn't grant allowances within 60 seconds, players can self-grant",
        "This prevents the game from getting stuck if authority is AFK"
      ],
      "discriminator": [
        89,
        131,
        35,
        202,
        197,
        228,
        1,
        16
      ],
      "accounts": [
        {
          "name": "player",
          "docs": [
            "The player granting their own allowance (must be the seat owner)"
          ],
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
          "name": "playerSeat",
          "writable": true
        },
        {
          "name": "allowanceCard1",
          "docs": [
            "Allowance account for card 1 (will be created by Inco CPI)"
          ],
          "writable": true
        },
        {
          "name": "allowanceCard2",
          "docs": [
            "Allowance account for card 2 (will be created by Inco CPI)"
          ],
          "writable": true
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
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
        }
      ]
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
          "name": "player",
          "writable": true,
          "signer": true,
          "relations": [
            "playerSeat"
          ]
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
      "name": "requestShuffle",
      "docs": [
        "Request VRF randomness for card shuffling",
        "This initiates the shuffle - VRF oracle will callback with randomness",
        "",
        "IMPORTANT: Pass all player seat accounts as remaining_accounts!",
        "The callback will shuffle + encrypt cards atomically."
      ],
      "discriminator": [
        130,
        20,
        53,
        22,
        23,
        102,
        225,
        135
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
          "name": "oracleQueue",
          "writable": true,
          "address": "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
        },
        {
          "name": "incoProgram",
          "docs": [
            "The Inco Lightning program for encryption (passed to callback)"
          ],
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "revealCards",
      "docs": [
        "Reveal cards at showdown with Ed25519 signature verification",
        "",
        "Players call this at Showdown phase to reveal their decrypted cards.",
        "The transaction must include Ed25519 verification instructions from",
        "Inco's attested decryption to prove the revealed values are correct."
      ],
      "discriminator": [
        49,
        29,
        188,
        98,
        30,
        81,
        141,
        168
      ],
      "accounts": [
        {
          "name": "player",
          "docs": [
            "The player revealing their cards (must be the seat owner)"
          ],
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
          "name": "playerSeat",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "table"
              },
              {
                "kind": "account",
                "path": "player_seat.seat_index",
                "account": "playerSeat"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Instructions sysvar for Ed25519 signature verification"
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "card1",
          "type": "u8"
        },
        {
          "name": "card2",
          "type": "u8"
        }
      ]
    },
    {
      "name": "revealCommunity",
      "docs": [
        "Reveal community cards (flop/turn/river) with Ed25519 signature verification",
        "",
        "Authority calls this when betting round completes and community cards need to be revealed.",
        "Community cards are encrypted during VRF shuffle for privacy - this reveals them.",
        "",
        "The transaction must include Ed25519 verification instructions for each card from",
        "Inco's attested decryption to prove the revealed values are correct.",
        "",
        "Card count depends on phase:",
        "- PreFlop -> Flop: 3 cards (or 5 if all-in runout)",
        "- Flop -> Turn: 1 card (or 2 if all-in runout)",
        "- Turn -> River: 1 card"
      ],
      "discriminator": [
        197,
        172,
        51,
        186,
        18,
        152,
        175,
        87
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Caller revealing the community cards",
            "Authority can call immediately, others must wait for timeout"
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
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Instructions sysvar for Ed25519 signature verification"
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cards",
          "type": "bytes"
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
    },
    {
      "name": "timeoutReveal",
      "docs": [
        "Timeout a player who hasn't revealed cards at showdown",
        "After 3 minutes without revealing, any player can call this to \"muck\" the non-revealer",
        "Mucked players forfeit their claim to the pot (standard poker rules)"
      ],
      "discriminator": [
        121,
        66,
        126,
        106,
        105,
        217,
        15,
        105
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
          "name": "targetPlayer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "targetSeat",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
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
      "msg": "Deck not yet shuffled - request VRF shuffle first"
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
      "msg": "Ed25519 signature verification failed"
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
      "name": "deckState",
      "docs": [
        "Encrypted deck state for a hand",
        "Cards are stored as Inco encrypted handles",
        "",
        "SECURITY NOTE: The VRF seed is NEVER stored here!",
        "It only exists in memory during the atomic shuffle+encrypt in callback_shuffle.",
        "This eliminates the account state leak vector."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hand",
            "docs": [
              "Reference to hand"
            ],
            "type": "pubkey"
          },
          {
            "name": "cards",
            "docs": [
              "Shuffled encrypted cards (Inco handles)",
              "Each u128 is a handle to an encrypted card value (0-51)",
              "First 5 cards (indices 0-4) are community cards (plaintext until revealed)",
              "Remaining cards are encrypted hole cards"
            ],
            "type": {
              "array": [
                "u128",
                52
              ]
            }
          },
          {
            "name": "dealIndex",
            "docs": [
              "Next card index to deal"
            ],
            "type": "u8"
          },
          {
            "name": "isShuffled",
            "docs": [
              "Whether deck has been shuffled and cards encrypted"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future use (maintains account size compatibility)",
              "Previously: vrf_seed [u8; 32] + seed_received bool = 33 bytes"
            ],
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          }
        ]
      }
    },
    {
      "name": "gamePhase",
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
            "name": "holeCard1",
            "docs": [
              "Encrypted hole card 1 (Inco handle)"
            ],
            "type": "u128"
          },
          {
            "name": "holeCard2",
            "docs": [
              "Encrypted hole card 2 (Inco handle)"
            ],
            "type": "u128"
          },
          {
            "name": "revealedCard1",
            "docs": [
              "Revealed plaintext card 1 (0-51, or 255 if not revealed)",
              "Set via reveal_cards instruction with Ed25519 verification"
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
    }
  ]
};
