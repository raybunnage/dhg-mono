# Expert Mnemonic Reference

This file lists the mnemonic codes for experts in the database. These mnemonics are used for quickly assigning experts to folders using the `assign-expert -i` command.

## Expert Mnemonics

| Mnemonic | Expert Name | Mnemonic | Expert Name | Mnemonic | Expert Name | Mnemonic | Expert Name | Mnemonic | Expert Name |
|----------|-------------|----------|-------------|----------|-------------|----------|-------------|----------|-------------|
| ABB | Abbas | ABC | abcdedfghi | ABE | Abernathy | ABR | Abernethy | ALL | Allison |
| AMS | Amster | AND | Anderson | ANO | Anonymous | APK | Apkarian | ARI | Aria |
| ACP | Aria, Carter, Patterson | ARN | Arndt | ASH | Ashar | BAK | Baker | BAR | Barrett |
| BAS | Barsalou | BEZ | Bezruchka | BUN | Bunnage | CAR | Carter | CCH | Carter Clawson Hanscom |
| CCH | Carter,Clawson,Hanscom | CHN | Carter, Horn | CLK | Clark | CLW | Clauw | CLS | Clawson |
| COL | Cole | CON | Constable | COK | Cook | CCK | Cook Clawson | DAL | Dale |
| DAN | Dantzer | DAV | Davis | DEH | Dehaene | DUN | Duncan | EAG | Eagle |
| EAR | Eagle Armster | EBN | Ebunnage | EIS | Eisenberger | ESC | Escalante | FRA | Fradkin |
| FRI | Friston | GAR | Garbo | GER | Germer | GEV | Gervitz | GEZ | Gevirtz |
| GRI | Grinevich | HAL | Halaris | HAN | Hanscom | HAR | Harris | HCL | Hanscom, Clawson |
| HCT | Horn, Carter | HRN | Horn | KJV | Kjaervik | KJR | Kjearvik | KPG | Kovacic, Porges |
| LAN | Langenecker | LNS | Lanius | LDV | Lane Davis | LDR | Lederman | LIP | Lipov |
| LPN | Lipton | LSK | Luskin | LST | Lustig | MAN | Mancini | MAR | Marano |
| MER | Meredith | MIL | Miller | NAP | Napadow | NAT | Nathan | NAV | Naviaux |
| NCL | Naviaux, Clawson | NEW | Newman | OTH | Othmer | OVE | Overman | PAN | Panda |
| PND | Pandi | PCR | Patterson Carter | PEN | Pennebaker | PEP | Peper | PPR | Pepper |
| PEZ | Pezzulo | POH | Pohl | POR | Porges | PCL | Porges, Clawson | PLT | Porges, Lederman |
| RAI | Raichle | RED | Redfield | RES | Restauri | ROG | Roger | SAB | Sabey |
| SAN | Sanders | SCH | Schubiner | SEI | Seigel | SHA | Shah | SIG | Siegel |
| SIM | Simonsson | STA | Staats | SCL | Staats, Clawson | STO | Stone | SBL | Sullivan, Ballantyne |
| SUL | Sullivan | SUT | Sutphin | TAR | Tarnopolosy | TMI | Terry Miller | WAG | Wager |
| WLK | Wilkinson | WPG | Whitaker, Porges |

## Using Mnemonics

When assigning experts to folders with the interactive command:

```bash
./scripts/cli-pipeline/experts/experts-cli.sh assign-expert -i
```

You can enter the 3-character mnemonic code for each expert when prompted instead of typing their full name.

## Adding Custom Mnemonics

When adding new experts, you can specify a custom mnemonic using:

```bash
./scripts/cli-pipeline/experts/experts-cli.sh add-expert --expert-name "Expert Name" --mnemonic "XYZ"
```

If no mnemonic is provided, one will be automatically generated based on the expert's name.