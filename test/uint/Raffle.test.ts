import { assert, expect } from "chai";
import { developmentChains, networkConfig } from "../../helper.hardhat.config";
import { network, ethers } from "hardhat";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { getNamedAccounts, deployments } from "hardhat";
import { BigNumber } from "ethers";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async () => {
          let raffle: Raffle, vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
          let raffleEntranceFee: BigNumber;
          let deployer: string;
          let interval: BigNumber;
          const chainId = network.config.chainId;
          // 测试开始之前，首先部署所有的合约，也就是Mock合约和Raffle合约，先部署Mock，后部署Raffle
          beforeEach(async () => {
              const { deploy, log } = deployments;
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture("all"); // 所有的合约都会被部署，相当于运行yarn hardhat deploy --tags all
              raffle = (await ethers.getContract("Raffle", deployer)) as Raffle;
              vrfCoordinatorV2Mock = (await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              )) as VRFCoordinatorV2Mock;
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", async () => {
              it("initialize the raffle correctly", async () => {
                  // 理想情况下，一个it一个assert，但是这里比较松
                  const raffleState = await raffle.getRaffleState();
                  const interval = await raffle.getInterval();
                  assert.equal(raffleState.toString(), "0", "raffle state should be OPEN");
                  assert.equal(interval.toString(), networkConfig[chainId!]["interval"], "interval should be 30");
              });
          });
          describe("enterRaffle", async () => {
              it("Revert when you don't pay enough", async () => {
                  //   const entranceFee = await raffle.getEntranceFee();
                  //   const entranceFeeLess = entranceFee.sub(1);
                  //   await expect(raffle.enterRaffle({ value: entranceFeeLess })).to.be.revertedWith(
                  //       "NotEnoughETHEntered"
                  //   );
                  await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered");
              });
              // 检查发送钱的人确实被记录了
              it("Record players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0); // 第一个给钱的用户
                  assert.equal(playerFromContract, deployer);
              });
              // 检查event是否正常触发
              it("emit event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter"); // 期望触发这个event
              });
              // 在计算时返回NotOpen错误
              it("Doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // 这里的关键点在于怎么模拟时间流转和状态变化，也就是怎么让状态变成Calculating
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  await raffle.performUpkeep([]); // 此时调用应该是成功的
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
              });
          });
          describe("checkUpkeep", async () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  await raffle.performUpkeep("0x"); // 0x和[]都是空调用
                  const raffleState: number = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), "1");
                  assert(!upkeepNeeded);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed and has players, eth and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(upkeepNeeded);
              });
          });
          describe("performUpkeep", async () => {
              it("it can only run if checkUpkeep returns true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts when checkupkeep is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWith("Raffle__UpkeepNotNeeded"); // 还没过interval，所以应该返回false
              });
              it("updates the raffle state, emits and event, and calls the vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                  await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.events![1].args?.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert.equal(raffleState.toString(), "1");
              });
              describe("fulfillRandomWords", () => {
                  beforeEach(async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // 模拟时间前进了Interval
                      await network.provider.send("evm_mine", []); // 模拟挖出了一个Block
                  });
                  it("can only be called after performUpkeeping", async () => {
                      await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith(
                          "nonexistent request"
                      );
                      await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith(
                          "nonexistent request"
                      );
                  });
                  it("picks a winner, resets the lottery, and sends money", async () => {
                      const additionalEntrants = 3;
                      const startingAccountingIndex = 1; // 因为默认的部署者是0
                      const accounts = await ethers.getSigners(); // 目前所有的参与者
                      for (let i = startingAccountingIndex; i < startingAccountingIndex + additionalEntrants; i++) {
                          const accountConnectedRaffle = raffle.connect(accounts[i]); // 让合约与我们pick出来的账户连接
                          await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee }); // 让这个账户参与抽奖
                      }
                      const startingTimestamp = await raffle.getLastestTimestamp();

                      // performUpkeep
                      // fulfillRandomWords (mock being the chainlink VRF)
                      // We will have to wait for the fulfillRandomWords to be
                      await new Promise<void>(async (resolve, reject) => {
                          raffle.once("WinnerPicked", async () => {
                              // Winner已经选出来了！
                              // 如果这个event在200s内没有被调用，那么测试就会算失败
                              console.log("Found the event!");
                              try {
                                  const recentWinner = await raffle.getRecentWinner();
                                  console.log(recentWinner);
                                  console.log(accounts[0].address);
                                  console.log(accounts[1].address);
                                  console.log(accounts[2].address);
                                  console.log(accounts[3].address);
                                  const raffleState = await raffle.getRaffleState();
                                  const endingTimestamp = await raffle.getLastestTimestamp();
                                  const numPlayers = await raffle.getNumberOfPlayers();
                                  const winnerEndingBalance = await accounts[1].getBalance();
                                  assert.equal(numPlayers.toString(), "0");
                                  assert.equal(raffleState.toString(), "0");
                                  assert(endingTimestamp > startingTimestamp);
                                  assert.equal(
                                      winnerEndingBalance.toString(),
                                      winnerStartingBalance
                                          .add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee))
                                          .toString()
                                  );
                              } catch (e) {
                                  reject(e);
                              }
                              resolve();
                          }); // 最前面这一行设置了一个eventListener，然后直接往下执行，执行完了fulfillRandomWords
                          const tx = await raffle.performUpkeep("0x"); // 得到对应的requestId，然后用requestId来调用fulfillRandomWords
                          const txReceipt = await tx.wait(1);
                          const winnerStartingBalance = await accounts[1].getBalance();
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              txReceipt.events![1].args?.requestId,
                              raffle.address
                          );
                      });
                  });
              });
          });
      });
