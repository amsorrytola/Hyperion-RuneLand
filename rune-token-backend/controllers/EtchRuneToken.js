import {
  script,
  Psbt,
  initEccLib,
  networks,
  crypto,
  payments
} from 'bitcoinjs-lib'
import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import ecc from '@bitcoinerlab/secp256k1'
import axios from 'axios'
import {
  Rune,
  Runestone,
  EtchInscription,
  none,
  some,
  Terms,
  Range,
  Etching
} from 'runelib'
import { tapleafHash } from 'bitcoinjs-lib/src/payments/bip341.js'
import { config } from 'dotenv'

import { WIFWallet } from '../utils/WIFWallet.js'

initEccLib(ecc)
const networkConfig = {
  networkType: 'testnet'
}

const ECPair = ECPairFactory(ecc)
const network = networks.testnet
const networkType = networkConfig.networkType

const privateKey = process.env.WIF_KEY

const wallet = new WIFWallet({
  networkType: networkType,
  privateKey: privateKey
})

function getRuneNameAndSpacers (originalName) {
  let runeName = ''
  let spacers = 0
  let index = 0 // tracks position in runeName

  for (let i = 0; i < originalName.length; i++) {
    const char = originalName[i]
    if (char === ' ') {
      // Set bit at current index (spacer goes before next letter)
      spacers |= 1 << index
    } else {
      runeName += char
      index++ // Only increase when char is not a space
    }
  }

  return { runeName, spacers }
}
export async function etching (req, res) {
  const name = 'HYPERIONRUNE'

  const keyPair = wallet.ecPair

  const ins = new EtchInscription()

  const fee = 1500
  const HTMLContent = `this token Is Made By Hyperion Team IIT Roorkee in G.C Tech `

  ins.setContent('text/html;charset=utf-8', Buffer.from(HTMLContent, 'utf8'))

  const xOnlyPubkey = Buffer.from(toXOnly(keyPair.publicKey)).toString('hex')
  console.log(xOnlyPubkey)

  const etching_script_asm = `${xOnlyPubkey} OP_CHECKSIG`

  const { runeName, spacers } = getRuneNameAndSpacers(name)
  ins.setRune(name)

  console.log(runeName, spacers)
  const etching_script = Buffer.concat([
    script.fromASM(etching_script_asm),
    ins.encipher()
  ])

  const scriptTree = {
    output: etching_script
  }

  const script_p2tr = payments.p2tr({
    internalPubkey: Buffer.from(toXOnly(keyPair.publicKey)),
    scriptTree,
    network
  })

  const etching_redeem = {
    output: etching_script,
    redeemVersion: 192
  }

  const etching_p2tr = payments.p2tr({
    internalPubkey: Buffer.from(toXOnly(keyPair.publicKey)),
    scriptTree,
    redeem: etching_redeem,
    network
  })

  const address = script_p2tr.address ?? ''
  console.log('send coin to address', address)

  const utxos = await waitUntilUTXO(address)
  console.log(`Using UTXO ${utxos[0].txid}:${utxos[0].vout}`)

  const psbt = new Psbt({ network })

  psbt.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: { value: utxos[0].value, script: script_p2tr.output },
    tapLeafScript: [
      {
        leafVersion: etching_redeem.redeemVersion,
        script: etching_redeem.output,
        controlBlock: etching_p2tr.witness[etching_p2tr.witness.length - 1]
      }
    ]
  })

  const rune = Rune.fromName(name)

  const terms = new Terms(
    1000,
    100000000000000,
    new Range(none(), none()),
    new Range(none(), none())
  )

  const etching = new Etching(
    some(4),
    some(1000000),
    some(rune),
    none(),
    some('H'),
    some(terms),
    true
  )

  const stone = new Runestone([], some(etching), none(), none())
  console.log('encoded rune', stone.encipher())
  psbt.addOutput({
    script: stone.encipher(),
    value: 0
  })

  const change = utxos[0].value - 546 - fee

  psbt.addOutput({
    address: 'tb1qqptwr8z9ypyu8mhpxutvfd70dnms6d84czvpq0', // change address
    value: 546
  })

  psbt.addOutput({
    address: 'tb1qqptwr8z9ypyu8mhpxutvfd70dnms6d84czvpq0', // change address
    value: change
  })
  const leafHash = tapleafHash({
    output: etching_redeem.output,
    version: etching_redeem.redeemVersion
  })

  const sighash = psbt.__CACHE.__TX.hashForWitnessV1(
    0,
    [psbt.data.inputs[0].witnessUtxo.script],
    [psbt.data.inputs[0].witnessUtxo.value],
    bitcoin.Transaction.SIGHASH_DEFAULT,
    leafHash
  )

  const signature = keyPair.signSchnorr(sighash)

  psbt.updateInput(0, {
    tapScriptSig: [
      {
        pubkey: Buffer.from(toXOnly(keyPair.publicKey)),
        signature: Buffer.from(signature),
        leafHash
      }
    ]
  })

  // return { keyPair, psbt, address }
  await signAndSend(keyPair, psbt, address)
}

// main

const blockstream = new axios.Axios({
  baseURL: `https://mempool.space/testnet/api`
})

export async function waitUntilUTXO (address) {
  return new Promise((resolve, reject) => {
    let intervalId
    const checkForUtxo = async () => {
      try {
        const response = await blockstream.get(`/address/${address}/utxo`)
        const data = response.data ? JSON.parse(response.data) : undefined
        console.log(data)
        if (data.length > 0) {
          resolve(data)
          clearInterval(intervalId)
        }
      } catch (error) {
        reject(error)
        clearInterval(intervalId)
      }
    }
    intervalId = setInterval(checkForUtxo, 5000)
  })
}
etching()
export async function getTx (id) {
  const response = await blockstream.get(`/tx/${id}/hex`)
  return response.data
}

export async function signAndSend (keyPair, psbt, address) {
  if (true) {
    psbt.finalizeAllInputs()

    const tx = psbt.extractTransaction()
    console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`)
    console.log(tx.virtualSize())
    const txid = await broadcast(tx.toHex())
    console.log(`Success! Txid is ${txid}`)
  } else {
    // in browser

    try {
      let res = await window.unisat.signPsbt(psbt.toHex(), {
        toSignInputs: [
          {
            index: 0,
            address: address
          }
        ]
      })

      console.log('signed psbt', res)

      res = await window.unisat.pushPsbt(res)

      console.log('txid', res)
    } catch (e) {
      console.log(e)
    }
  }
}

export async function broadcast (txHex) {
  const response = await blockstream.post('/tx', txHex)
  return response.data
}

function tapTweakHash (pubKey, h) {
  return crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey])
  )
}

function toXOnly (pubkey) {
  return pubkey.subarray(1, 33)
}
