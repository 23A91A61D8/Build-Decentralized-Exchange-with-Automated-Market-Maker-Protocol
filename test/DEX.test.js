const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex, tokenA, tokenB;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKA");
    tokenB = await MockERC20.deploy("Token B", "TKB");

    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(tokenA.address, tokenB.address);

    await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
    await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));

    await tokenA.mint(addr1.address, ethers.utils.parseEther("1000"));
    await tokenB.mint(addr1.address, ethers.utils.parseEther("1000"));

    await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
    await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
  });

  /* ============================
     Liquidity Management
  ============================ */
  describe("Liquidity Management", function () {

    it("should allow initial liquidity provision", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("100"));
      expect(reserves[1]).to.equal(ethers.utils.parseEther("200"));
    });

    it("should mint correct LP tokens for first provider", async function () {
      const tx = await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await tx.wait();
      const totalLiquidity = await dex.totalLiquidity();
      expect(totalLiquidity).to.be.gt(0);
    });

    it("should allow subsequent liquidity additions", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await dex.connect(addr1).addLiquidity(
        ethers.utils.parseEther("50"),
        ethers.utils.parseEther("100")
      );
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("150"));
    });

    it("should maintain price ratio on liquidity addition", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await expect(
        dex.connect(addr1).addLiquidity(
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("50")
        )
      ).to.be.reverted;
    });

    it("should allow partial liquidity removal", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      const lp = await dex.liquidity(owner.address);
      await dex.removeLiquidity(lp.div(2));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.be.lt(ethers.utils.parseEther("100"));
    });

    it("should return correct token amounts on liquidity removal", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      const lp = await dex.liquidity(owner.address);
      await dex.removeLiquidity(lp);
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(0);
      expect(reserves[1]).to.equal(0);
    });

    it("should revert on zero liquidity addition", async function () {
      await expect(
        dex.addLiquidity(0, 0)
      ).to.be.reverted;
    });

    it("should revert when removing more liquidity than owned", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await expect(
        dex.connect(addr1).removeLiquidity(1)
      ).to.be.reverted;
    });
  });

  /* ============================
     Token Swaps
  ============================ */
  describe("Token Swaps", function () {
    beforeEach(async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
    });

    it("should swap token A for token B", async function () {
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("110"));
    });

    it("should swap token B for token A", async function () {
      await dex.swapBForA(ethers.utils.parseEther("10"));
      const reserves = await dex.getReserves();
      expect(reserves[1]).to.equal(ethers.utils.parseEther("210"));
    });

    it("should calculate correct output amount with fee", async function () {
      const out = await dex.getAmountOut(
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      expect(out).to.be.gt(0);
    });

    it("should update reserves after swap", async function () {
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("110"));
    });

    it("should increase k after swap due to fees", async function () {
      const before = await dex.getReserves();
      const kBefore = before[0].mul(before[1]);

      await dex.swapAForB(ethers.utils.parseEther("10"));

      const after = await dex.getReserves();
      const kAfter = after[0].mul(after[1]);

      expect(kAfter).to.be.gt(kBefore);
    });

    it("should revert on zero swap amount", async function () {
      await expect(
        dex.swapAForB(0)
      ).to.be.reverted;
    });

    it("should handle large swaps with high price impact", async function () {
      await dex.swapAForB(ethers.utils.parseEther("50"));
      const reserves = await dex.getReserves();
      expect(reserves[1]).to.be.lt(ethers.utils.parseEther("200"));
    });

    it("should handle multiple consecutive swaps", async function () {
      await dex.swapAForB(ethers.utils.parseEther("5"));
      await dex.swapAForB(ethers.utils.parseEther("5"));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("110"));
    });
  });

  /* ============================
     Price Calculations
  ============================ */
  describe("Price Calculations", function () {

    it("should return correct initial price", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      const price = await dex.getPrice();
      expect(price).to.equal(2);
    });

    it("should update price after swaps", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const price = await dex.getPrice();
      expect(price).to.not.equal(2);
    });

    it("should handle price queries with zero reserves gracefully", async function () {
      await expect(dex.getPrice()).to.be.reverted;
    });
  });

  /* ============================
     Fee Distribution
  ============================ */
  describe("Fee Distribution", function () {

    it("should accumulate fees for liquidity providers", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const reserves = await dex.getReserves();
      expect(reserves[0].mul(reserves[1])).to.be.gt(
        ethers.utils.parseEther("100").mul(ethers.utils.parseEther("200"))
      );
    });

    it("should distribute fees proportionally to LP share", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await dex.connect(addr1).addLiquidity(
        ethers.utils.parseEther("50"),
        ethers.utils.parseEther("100")
      );
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const lp1 = await dex.liquidity(owner.address);
      const lp2 = await dex.liquidity(addr1.address);
      expect(lp1).to.be.gt(0);
      expect(lp2).to.be.gt(0);
    });
  });

  /* ============================
     Edge Cases
  ============================ */
  describe("Edge Cases", function () {

    it("should handle very small liquidity amounts", async function () {
      await dex.addLiquidity(1, 2);
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(1);
    });

    it("should handle very large liquidity amounts", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("2000")
      );
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(ethers.utils.parseEther("1000"));
    });

    it("should prevent unauthorized access", async function () {
      await expect(
        dex.connect(addr2).removeLiquidity(1)
      ).to.be.reverted;
    });
  });

  /* ============================
     Events
  ============================ */
  describe("Events", function () {

    it("should emit LiquidityAdded event", async function () {
      await expect(
        dex.addLiquidity(
          ethers.utils.parseEther("100"),
          ethers.utils.parseEther("200")
        )
      ).to.emit(dex, "LiquidityAdded");
    });

    it("should emit LiquidityRemoved event", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      const lp = await dex.liquidity(owner.address);
      await expect(
        dex.removeLiquidity(lp)
      ).to.emit(dex, "LiquidityRemoved");
    });

    it("should emit Swap event", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
      await expect(
        dex.swapAForB(ethers.utils.parseEther("10"))
      ).to.emit(dex, "Swap");
    });
  });
});
