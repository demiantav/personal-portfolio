const setClock = () => {
  const d = document;
  const $hour = d.querySelector('.hour');
  const $colon = d.querySelector('.colon');
  const $minutes = d.querySelector('.minutes');

  const updateTime = () => {
    const now = new Date();
    console.log(now.getHours());
    const options = { hour: '2-digit', minute: '2-digit', hour12: false };
    const timeString = now.toLocaleTimeString('it-IT', options);

    const [hours, minutes] = timeString.split(':');

    $hour.textContent = hours;
    $minutes.textContent = minutes;
  };

  updateTime();
  setInterval(updateTime, 60000);
};

export default setClock;
