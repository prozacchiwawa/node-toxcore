/*
 * This file is part of node-toxcore.
 *
 * node-toxcore is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * node-toxcore is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with node-toxcore. If not, see <http://www.gnu.org/licenses/>.
 *
 */

/**
 * A tiny tox bot example using node-toxcore's synchronous methods (new_api).
 */
var testingMode=false;

var dgram = require('dgram');
var path = require('path');
var ipaddr = require('ipaddr.js');
var toxcore = !testingMode ? require('toxcore') : require(path.join(__dirname, '..', '..', 'lib', 'main'));

var tox = null;
var tox_sock = { };
var makesocket = function(s) {
  var so = dgram.createSocket('udp6');
  so.bind(s.port, '::');
  so.on('message', function(msg,rinfo) {
    console.log('received',rinfo);
    tox.receivedPacket(msg,rinfo);
  });
  tox_sock[s.sock] = so;
  return so;
};

tox = new toxcore.Tox({makesocket: makesocket, 'ipv6': true});

/**
 * Bootstrap tox via hardcoded nodes.
 * For more nodes, see: https://wiki.tox.chat/users/nodes
 */
 var nodes = [
  { maintainer: 'sonOfRa',
    address: '144.76.60.215',
    port: 33445,
    key: '04119E835DF3E78BACF0F84235B300546AF8B936F035185E2A8E9E0A67C8924F' },
  { maintainer: 'me',
    address: '50.116.2.208',
    port: 33445,
    key: 'A62A2DD01CDC7B5CC4A42C2189BB56818552A4CA258420536C6075A8AAB55019' }
];

tox.on('send', function(pkt) {
  console.log('sock',pkt.sock, 'ip_port', pkt.ip_port, 'length', pkt.length);
  var family = pkt.ip_port[0];
  var addr;
  var port = (pkt.ip_port[24] * 256) + pkt.ip_port[25];
  if (family == 2) {
    addr = '::ffff:' + 
        ([pkt.ip_port[8],
          pkt.ip_port[9],
          pkt.ip_port[10],
          pkt.ip_port[11]].join('.'));
  } else {
    var addrArr = [];
    for (var i = 0; i < 16; i++) {
      addrArr.push(pkt.ip_port[8+i]);
    }
    addr = ipaddr.fromByteArray(addrArr).toString();
  }
  var raddr = { address: addr, port: port };
  console.log('to',raddr,'pkt.length',pkt.length);
  try {
    tox_sock[pkt.sock].send(pkt.data, 0, pkt.length, port, addr);
  } catch(e) {
    console.log('error sending',e);
  }
});

// Bootstrap from nodes
nodes.forEach(function(node) {
  tox.bootstrap(node.address, node.port, node.key);
  console.log('Started bootstrap from ' + node.maintainer + ' at ' + node.address + ':' + node.port);
  console.log('... with key ' + node.key);
});

tox.on('selfConnectionStatus', function(e) {
  console.log(e.isConnected() ? 'Connected' : 'Disconnected');
});

tox.on('friendName', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  console.log(name + '[' + e.friend() + '] changed their name: ' + e.name());
});

tox.on('friendStatusMessage', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  console.log(name + '[' + e.friend() + '] changed their status message: ' + e.statusMessage());
});

tox.on('friendStatus', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  console.log(name + '[' + e.friend() + '] changed their status: ' + e.status());
});

tox.on('friendConnectionStatus', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  var statusMessage = tox.getFriendStatusMessageSync(e.friend());
  console.log(name + '[' + e.friend() + '] is now ' + (e.isConnected() ? 'online' : 'offline') + ': ' + statusMessage);

});

tox.on('friendTyping', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  console.log(name + '[' + e.friend() + '] is ' + (e.isTyping() ? 'typing' : 'not typing'));
});

tox.on('friendReadReceipt', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  console.log(name + '[' + e.friend() + '] receipt: ' + e.receipt());
});

tox.on('friendRequest', function(e) {
  tox.addFriendNoRequestSync(e.publicKey());
  console.log('Received friend request: ' + e.message());
  console.log('Accepted friend request from ' + e.publicKeyHex());
});

tox.on('friendMessage', function(e) {
  var name = tox.getFriendNameSync(e.friend());
  if(e.isAction()) {
    console.log('** ' + name + '[' + e.friend() + '] ' + e.message() + ' **');
  } else {
    console.log(name + '[' + e.friend() + ']: ' + e.message());
  }
  // Echo the message back
  tox.sendFriendMessageSync(e.friend(), e.message(), e.messageType());

  if(e.message() === 'typing on') {
    tox.setTypingSync(e.friend(), true);
    console.log('Started typing to ' + name + '[' + e.friend() + ']');
  } else if(e.message() === 'typing off') {
    tox.setTypingSync(e.friend(), false);
    console.log('Stopped typing to ' + name + '[' + e.friend() + ']');
  }

  if(e.message() === 'profile') {
    var statusMessage = tox.getFriendStatusMessageSync(e.friend()),
        status = tox.getFriendStatusSync(e.friend()),
        connectionStatus = tox.getFriendConnectionStatusSync(e.friend());
    console.log('Friend ' + e.friend() + ' profile:');
    console.log('  Name: ' + name);
    console.log('  Status message: ' + statusMessage);
    console.log('  Status: ' + status);
    console.log('  Connection status: ' + connectionStatus);
  }

  if(e.message() === 'lastonline') {
    var lastOnline = tox.getFriendLastOnlineSync(e.friend());
    console.log(name + ' last online: ' + lastOnline.toString());
  }

  if(e.message() === 'namelen') {
    console.log('Name length: ' + tox.getFriendNameSizeSync(e.friend()));
    console.log('Status message length: ' + tox.getFriendStatusMessageSizeSync(e.friend()));
  }
});

tox.on('friendLosslessPacket', function(e){
  var name = tox.getFriendNameSync(e.friend());  
  console.log('**Received lossless packet from ' + '[' + e.friend() + ']');
  console.log(e.data().toString());
  tox.sendLosslessPacketSync(e.friend(), new Buffer('lossless-receipt-packet-content'));
});

tox.setNameSync('Sync Bot');
tox.setStatusMessageSync('node-toxcore sync bot example');

console.log('Address: ' + tox.getAddressHexSync());

// Start the tox_iterate loop
tox.start();
