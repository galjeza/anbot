import fetch from 'node-fetch';
export async function decreaseCredits(email) {
  console.log('Decreasing credit for', email);
  const response = await fetch(
    `https://avtonet-server.onrender.com/decrementCredit?email=${encodeURIComponent(
      email,
    )}`,
    { method: 'GET' },
  );
  if (!response.ok) {
    throw new Error(`Error decreasing credit: ${response.statusText}`);
  }
}
