import json

with open('../public/sitemap.xml', 'w') as xml_file:
  xml_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
  xml_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
  xml_file.write('\t<url>\n')
  xml_file.write(f'\t\t<loc>https://boilerclasses.com/</loc>\n')
  xml_file.write(f'\t\t<priority>1</priority>\n')
  xml_file.write('\t</url>\n')
  xml_file.write('\t<url>\n')
  xml_file.write(f'\t\t<loc>https://boilerclasses.com/schedule</loc>\n')
  xml_file.write(f'\t\t<priority>1</priority>\n')
  xml_file.write('\t</url>\n')

with open('classes_out.json', 'r') as file:
  data = json.load(file)
  mx_terms = 0
  for class_data in data:
    mx_terms = max(mx_terms, len(class_data['terms']))
  for class_data in data:
    with open('../public/sitemap.xml', 'a') as xml_file:
      # xml_file.write('\t<url>\n')
      # xml_file.write(f'\t\t<loc>https://www.boilerclasses.com/detail/{class_data["detailId"]}</loc>\n')
      # xml_file.write(f'\t\t<priority>{round(len(class_data["terms"])/mx_terms, 2)}</priority>\n')
      # xml_file.write('\t</url>\n')
      xml_file.write('\t<url>\n')
      xml_file.write(f'\t\t<loc>https://boilerclasses.com/detail/{class_data["detailId"]}</loc>\n')
      xml_file.write(f'\t\t<priority>{round(len(class_data["terms"])/mx_terms, 2)}</priority>\n')
      xml_file.write('\t</url>\n')


# Add course directory to sitemap
class_codes = ["AAE", "AAS", "ABE", "ACCT", "AD", "AFT", "AGEC", "AGR", "AGRY", "AMST", "ANSC", "ANTH", "ARAB", "ARCH", "ASAM", "ASEC", "ASL", "ASM", "ASTR", "AT", "BAND", "BCHM", "BIOL", "BME", "BMS", "BTNY", "BUS", "CAND", "CCE", "CDIS", "CE", "CEM", "CGT", "CHE", "CHM", "CHNS", "CIT", "CLCS", "CLPH", "CM", "CMGT", "CMPL", "CNIT", "COM", "CPB", "CS", "CSCI", "CSR", "DANC", "DCTC", "DSB", "EAPS", "ECE", "ECET", "ECON", "EDCI", "EDPS", "EDST", "EEE", "ENE", "ENGL", "ENGR", "ENGT", "ENTM", "ENTR", "EPCS", "EXPL", "FIN", "FLM", "FNR", "FR", "FS", "FVS", "GEP", "GER", "GRAD", "GREK", "GS", "GSLA", "HDFS", "HEBR", "HER", "HETM", "HHS", "HIST", "HK", "HONR", "HORT", "HSCI", "HSOP", "HTM", "IBE", "IDE", "IDIS", "IE", "IET", "ILS", "IMPH", "IPPH", "INT", "IT", "ITAL", "JPNS", "JWST", "KOR", "LA", "LALS", "LATN", "LC", "LING", "MA", "MATH", "MCMP", "ME", "MET", "MFET", "MGMT", "MIS", "MKTG", "MSE", "MSL", "MSPE", "MUS", "NRES", "NS", "NUCL", "NUPH", "NUR", "NUTR", "OBHR", "OLS", "OPP", "PES", "PHIL", "PHPR", "PHRM", "PHSC", "PHYS", "POL", "PSY", "PTGS", "PUBH", "QM", "REAL", "REG", "REL", "RPMP", "RUSS", "SA", "SCI", "SCLA", "SCOM", "SFS", "SLHS", "SOC", "SPAN", "STAT", "STRT", "SYS", "TCM", "TDM", "TECH", "THTR", "TLI", "VCS", "VIP", "VM", "WGSS"]
with open('../public/sitemap.xml', 'a') as xml_file:
  xml_file.write('\t<url>\n')
  xml_file.write(f'\t\t<loc>https://www.boilerclasses.com/dir/</loc>\n')
  xml_file.write(f'\t\t<priority>1</priority>\n')
  xml_file.write('\t</url>\n')

  for class_code in class_codes:
    xml_file.write('\t<url>\n')
    xml_file.write(f'\t\t<loc>https://boilerclasses.com/dir/{class_code}</loc>\n')
    xml_file.write(f'\t\t<priority>1</priority>\n')
    xml_file.write('\t</url>\n')


with open('../public/sitemap.xml', 'a') as xml_file:
  xml_file.write('</urlset>\n')
