#!/bin/bash

cd "$(dirname "$0")"

VALID_DAYS=360
CA_KEY=ca.key
CA_CERT=ca.crt
SERVER_KEY=server.key
SERVER_CERT=server.crt
SERVER_CSR=server.csr
KEY_BITS=2048
CN="localhost"
ORG="Test Certificate"

echo "Create CA certificate..."
CN="Test CA"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:$KEY_BITS -out $CA_KEY
openssl req -new -x509 -days $VALID_DAYS -key $CA_KEY -subj "/CN=$CN/O=$ORG" -out $CA_CERT
echo "Done."

echo "Creating Server certificate..."
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:$KEY_BITS -out $SERVER_KEY
openssl req -new -key $SERVER_KEY -subj "/CN=$CN/O=$ORG" -out $SERVER_CSR
openssl x509 -days $VALID_DAYS -req -in $SERVER_CSR -CAcreateserial -CA $CA_CERT -CAkey $CA_KEY -out $SERVER_CERT

rm ca.crt
rm ca.key
rm ca.srl
rm server.csr
echo "Done."