import { assert, expect } from "chai";
import { developmentChains, networkConfig } from "../../helper.hardhat.config";
import { network, ethers } from "hardhat";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { getNamedAccounts, deployments } from "hardhat";
import { BigNumber } from "ethers";

// staging test 需要做的准备
// 1. 拿到Chainlink VRF的SubId
// 2. 使用subId部署合约
// 3. 使用subId和VRF来注册合约
// 4. 使用Chainlink Keepers 来注册合约
// 5. 运行

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", async () => {
          let raffle: Raffle;
          let raffleEntranceFee: BigNumber;
          let deployer: string;
          let interval: BigNumber;
          const chainId = network.config.chainId;
          // 对于单元测试，测试开始之前，首先部署所有的合约，也就是Mock合约和Raffle合约，先部署Mock，后部署Raffle
          // 但是对于staging test，并不需要部署Mock，而是找到Mock
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              console.log("deployer", deployer);
              //   await deployments.fixture("Raffle");
              raffle = (await ethers.getContract("Raffle", deployer)) as Raffle;
              console.log("raffle address: ", raffle.address);
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });
          describe("fulfillRandomWords", () => {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random number", async () => {
                  // enter the raffle
                  console.log("Setting up test...");
                  const startingTimestamp = await raffle.getLastestTimestamp();
                  const accounts = await ethers.getSigners();
                  for (let i = 0; i < accounts.length; i++) {
                      console.log(`account${i} ${accounts[i].address}`);
                  }
                  // set up the listener before we enter the raffle
                  console.log("Setting up listener...");
                  await new Promise<void>(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event emitted");
                          try {
                              // add our assertions here
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBlance = await accounts[0].getBalance();
                              console.log("winnerEndingBlance", winnerEndingBlance.toString());
                              const endingTimestamp = await raffle.getLastestTimestamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);

                              assert.equal(
                                  winnerEndingBlance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              );
                              assert(endingTimestamp > startingTimestamp);
                              console.log("Test passed!");
                              resolve();
                          } catch (e) {
                              console.log(e);
                              reject(e);
                          }
                      });
                      console.log("Entering raffle...");
                      console.log("raffleEntranceFee", raffleEntranceFee.toString());
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                      await tx.wait(1);
                      const winnerStartingBalance = await accounts[0].getBalance();
                      console.log("Winner starting balance: ", winnerStartingBalance.toString());
                      console.log("Waiting for Chainlink Keepers to pick a winner...");
                  });
                  // and thsi code won't complete until the Listener finishes listening
              });
          });
      });
