'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { FC } from 'react';
import { motion } from 'framer-motion';
import { useUnisatWallet } from "@/hooks/useUnisatWallet";
import { useState } from 'react';
import dayjs from 'dayjs';
import axios from "axios";



const Hero: FC = () => {
  const { connect: login, authenticated, logout } = useUnisatWallet();
  const router = useRouter();
  const [startEtching, setStartEtching] = useState(false);
  const [etches, setEtches] = useState<string[]>(["e7779d90ce8e70ced6119a4d71fe831ef325e648d7ee7b4823f9973c13d57402", "cfde24580653a01bc4be872c04b271e21bea207d996067e3d65257ecd8552a97"]);
  const [name, setName] = useState('');
  const [cap, setCap] = useState('');
  const [amount, setAmount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [divisiblity, setDivisiblity] = useState('');
  const [isEtching, setIsEtching] = useState(false);
  const [premine, setPremine] = useState('');
  const [txnId, setTxnId] = useState(null);

  const handleEtch = async () => {
    if (!name || !cap || !amount || !symbol || !divisiblity || !premine) {
      alert('Please fill all fields: name, cap, amount, symbol, and divisibility');
      return;
    }
    if (!window.unisat) {
      alert('Please install Unisat wallet')
      return
    }
    console.log(name, cap, amount, symbol, divisiblity, premine)
    const runeName = name.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const runeCap = parseInt(cap);
    const runeAmount = parseInt(amount);
    const runeSymbol = symbol.trim().toUpperCase();
    const runeDiv = parseInt(divisiblity);
    const runePremine = parseInt(premine);
    if (runeName.length < 1 || runeName.length > 26) {
      alert('Rune name must be between 1 and 26 letters (A-Z only)');
      return;
    }

    if (isNaN(runeCap) || runeCap <= 0) {
      alert('Cap must be a valid positive number');
      return;
    }

    if (isNaN(runeAmount) || runeAmount <= 0) {
      alert('Amount must be a valid positive number');
      return;
    }

    if (isNaN(runeDiv) || runeDiv < 0 || runeDiv > 38) {
      alert('Divisibility must be a number between 0 and 38');
      return;
    }
    console.log(runeName, runeCap, runeAmount, runeSymbol, runeDiv, runePremine)
    const [address] = await window.unisat.requestAccounts()
    const pubkey = await window.unisat.getPublicKey()
    console.log(address, pubkey)
    // Fetch UTXOs

    try {
      setIsEtching(true);
      const utxos = await window.unisat.getBitcoinUtxos()
      const res = await axios.get(`https://mempool.space/testnet/api/address/${address}/utxo`)
      console.log('UTXOs:', res.data)

      // const utxo = utxos.find(u => u.confirmations >= 6) // choose suitable one
      const utxo = utxos[0];
      console.log(utxo)
      const response = await fetch('http://localhost:8000/api/v1/etch-psbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          pubkey,
          utxo: {
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.satoshis,
            scriptPubKey: utxo.scriptPk, // hex string
          },
          name: runeName,
          cap: runeCap,
          amount: runeAmount,
          symbol: runeSymbol,
          divisibility: runeDiv,
          premine: runePremine
        })
      })

      const { psbt } = await response.json()

      const signedPsbt = await window.unisat.signPsbt(psbt, {
        autoFinalized: true
      })

      const txid = await window.unisat.pushPsbt(signedPsbt)
      console.log('Broadcasted with txid:', txid)
      setTxnId(txid)
    } catch (e) {
      console.log(e)
    }
    finally {
      setIsEtching(false);
    }
  };

  const handleEtchingToken = () => {
    setStartEtching(true);
  };


  async function getTxIndexInBlock(txid: String) {
    try {
      // Step 1: Get transaction details
      const txDetailsRes = await axios.get(
        `https://mempool.space/testnet/api/tx/${txid}`
      )
      // @ts-ignore
      const { status } = txDetailsRes.data

      if (!status || !status.block_height) {
        throw new Error('Transaction not yet confirmed in a block.')
      }

      const blockHeight = status.block_height
      const blockHash = status.block_hash

      // Step 2: Get txids in that block
      const blockTxsRes = await axios.get(
        `https://mempool.space/testnet/api/block/${blockHash}/txids`
      )

      const txids = blockTxsRes.data
      // @ts-ignore
      const index = txids.indexOf(txid)
      if (index === -1) {
        throw new Error('Transaction not found in block.')
      }

      return {
        txid,
        blockHeight,
        index
      }
    } catch (error) {
      // @ts-ignore
      console.error('Error fetching tx index:', error.message)
      return null
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1510]/50 to-[#1a1510]" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center px-4 max-w-4xl mx-auto"
      >
        <div className="space-y-8">
          <motion.h1
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#d4a373] via-[#ccd5ae] to-[#e9edc9]">
              Hyperion RuneLand
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-xl md:text-2xl text-[#ccd5ae] max-w-2xl mx-auto leading-relaxed"
          >
            Chainless Conquests: Where Runes Battle Across Realms, Rarity Reigns, and Legends are SoulBound.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
          >
            {!authenticated ? (
              <Button
                onClick={login}
                className="bg-gradient-to-r from-[#d4a373] to-[#ccd5ae] text-[#1a1510] px-8 py-3 rounded-lg hover:opacity-90 transition-all hover:scale-105"
              >
                Connect Wallet
              </Button>
            ) : (
              <Button
                onClick={handleEtchingToken}
                className="bg-gradient-to-r from-[#d4a373] to-[#ccd5ae] text-[#1a1510] px-8 py-3 rounded-lg hover:opacity-90 transition-all hover:scale-105"
              >
                Start Etching Token
              </Button>
            )}

            <Button
              variant="outline"
              className="border-[#d4a373] text-[#d4a373] hover:bg-[#d4a373]/10"
              onClick={() => window.open('https://docs.blockgame.com', '_blank')}
            >
              Learn More
            </Button>
          </motion.div>

          {startEtching && (
            <div className="mt-16 px-4">
              {/* Etching Form */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="max-w-4xl mx-auto bg-[#2a221b] p-8 rounded-2xl shadow-lg space-y-6"
              >
                <h2 className="text-3xl font-bold text-[#e9edc9] text-center">
                  🪄 Etch Your Rune Token
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  <input
                    type="text"
                    placeholder="Token Name"
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                  <input
                    type="number"
                    placeholder="Supply Cap"
                    onChange={(e) => setCap(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                  <input
                    type="text"
                    placeholder="Symbol"
                    onChange={(e) => setSymbol(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                  <input
                    type="number"
                    placeholder="Divisibility"
                    onChange={(e) => setDivisiblity(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                  <input
                    type="number"
                    placeholder="Premine"
                    onChange={(e) => setPremine(e.target.value)}
                    className="bg-[#1a1510] text-[#e9edc9] border border-[#d4a373] px-4 py-2 rounded-md placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#d4a373]"
                  />
                </div>

                <div className="text-center pt-4">
                  {isEtching ? (
                    <Button
                      variant="outline"
                      className="border-[#d4a373] text-[#d4a373] hover:bg-[#d4a373]/10 px-6 py-2"
                      disabled
                    >
                      Etching...
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleEtch}
                      className="border-[#d4a373] text-[#d4a373] hover:bg-[#d4a373]/10 px-6 py-2"
                    >
                      Etch Token
                    </Button>
                  )}
                </div>
              </motion.div>

              {/* Etched Token Cards */}
              <section className="max-w-5xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {etches.map((txid) => (
                  <motion.div
                    key={txid}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-[#2a221b] rounded-2xl p-6 shadow-md border border-[#d4a373]/30"
                  >
                    <h3 className="text-lg font-bold text-[#e9edc9] mb-1">
                      {/* @ts-ignore */}
                      🧿 Rune ID:
                    </h3>

                    <p className="text-sm text-[#fefae0] font-mono mb-3 break-words">{txid}</p>

                    {/* <p className="text-sm text-[#ccd5ae] mb-3">
                      ⏱️ Etched on{' '}
                      <time dateTime={new Date(1744914487).toISOString()}>
                        {dayjs(1744914487).format('MMMM D, YYYY h:mm A')}
                      </time>
                    </p> */}

                    <p className="text-xs text-[#999] font-mono mb-4 break-all">
                      {txid}
                    </p>

                    <a
                      href={`https://mempool.space/testnet/tx/${txid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-[#d4a373] text-[#1a1510] px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
                    >
                      View on Explorer
                    </a>
                  </motion.div>
                ))}

                {etches.length === 0 && (
                  <p className="col-span-full text-center text-[#ccd5ae]">
                    No etches yet — be the first!
                  </p>
                )}
              </section>
            </div>
          )}

        </div>
      </motion.div>

    </section>
  );
};

export default Hero;