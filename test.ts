let winner: Winner[] = [];
          const logs = await HungerLogModel.find({ game: game._id.toString() });

          let totalPool = 0;
          let totalWinnerPrize = 0;
          let isSended = false;

          if (logs.length > 0) {
            logs.map((log) => {
              totalPool = totalPool + log.enterencePrice;
            });

            let minus = totalPool - 0.5;
            let plus = totalPool + 0.5;
            console.log({ minus, plus });

            logs.map((log) => {
              if (log.estimate > minus && log.estimate < plus) {
                const prize = log.enterenceRate * log.enterencePrice;
                winner.push({
                  wallet: log.wallet,
                  enterenceRate: log.enterenceRate,
                  enterencePrice: log.enterencePrice,
                  prize,
                });
                totalWinnerPrize = totalWinnerPrize + prize;
              }
            });
          }
          // Transaction

          const bankWallet: number[] = deCrypt(game.bankWallet)
            .split(",")
            .map(Number)
            .slice(0, 64);
          const keyPairFromSeed = Keypair.fromSecretKey(
            new Uint8Array(bankWallet)
          );
          const bankPubkey = new PublicKey(keyPairFromSeed.publicKey);

          try {
            const connection = new Connection(
              "https://mainnet.helius-rpc.com/?api-key=47fc13b5-fa7f-467f-817e-ed1189204735"
            );
            const transaction = new Transaction();
            const bankWalletBalance = await connection.getBalance(bankPubkey);
            let bankBalance = bankWalletBalance / LAMPORTS_PER_SOL;

            if (bankBalance > totalWinnerPrize && winner.length > 0) {
              winner.map((user) => {
                transaction.add(
                  SystemProgram.transfer({
                    fromPubkey: bankPubkey,
                    toPubkey: new PublicKey(user.wallet),
                    lamports: user.prize * LAMPORTS_PER_SOL,
                  })
                );
                bankBalance = bankBalance - user.prize;
              });
            }
            const { blockhash, lastValidBlockHeight } =
              await connection.getLatestBlockhash();

            transaction.feePayer = bankPubkey;
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;

            const calculateFee = await connection.getFeeForMessage(
              transaction.compileMessage(),
              "confirmed"
            );

            if (typeof calculateFee.value === "number") {
              bankBalance = bankBalance - calculateFee.value / LAMPORTS_PER_SOL;
            }
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: bankPubkey,
                toPubkey: new PublicKey(
                  "9KsFBx5mwpeVM9z7V9mxarsPMLxqsYuqPRgaobk2HyAZ"
                ),
                lamports: bankBalance * LAMPORTS_PER_SOL - 5000,
              })
            );

            const tx = await sendAndConfirmTransaction(
              connection,
              transaction,
              [keyPairFromSeed]
            );

            console.log("Para başarıyla gönderildi!");
            isSended = true;
          } catch (err) {
            console.log(err);
          }
          console.log("Yeni tarih küçük");
          game.isActive = false;
          game.isSended = isSended;
          game.winners = winner;
          await game.save();
