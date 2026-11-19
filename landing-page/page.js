const plate = document.querySelector(".plate");
const mascot = document.querySelector(".bucky img");
const faces = ["bucky-classic", "bucky-chef", "bucky-sunglasses", "bucky-beanie"];
let turns = 0;
document.querySelector(".bucky").addEventListener("click", () => {
  turns++;
  plate.style.setProperty("--turn", turns * 60 + "deg");
  mascot.src = "assets/" + faces[turns % faces.length] + ".webp";
});
